import AppKit
import AuthenticationServices
import CryptoKit
import Security

@MainActor
final class Authentication: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published var account: SharedSession?
    @Published var message = ""
    @Published var busy = false
    private var webSession: ASWebAuthenticationSession?
    func reload() {
        do { account = try SharedSession.load(configuration: .current) }
        catch { message = error.localizedDescription }
    }
    func disconnect() {
        do { try SharedSession.disconnect(); account = nil; message = "" }
        catch { message = error.localizedDescription }
    }
    private func random() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw FlowyError.message("Could not start secure sign-in.") }
        return Data(bytes).base64URL
    }
    func connect() {
        guard !busy else { return }
        do {
            let config = try APIConfiguration.current
            let verifier = try random(), state = try random()
            let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
            var url = URLComponents(url: config.endpoint("mac/connect"), resolvingAgainstBaseURL: false)!
            url.queryItems = [URLQueryItem(name: "challenge", value: challenge), URLQueryItem(name: "state", value: state)]
            busy = true
            message = ""
            webSession = ASWebAuthenticationSession(url: url.url!, callbackURLScheme: APIConfiguration.callbackScheme) { [weak self] callback, error in
                Task { @MainActor in
                    guard let self else { return }
                    defer { self.busy = false; self.webSession = nil }
                    if let error {
                        if (error as? ASWebAuthenticationSessionError)?.code != .canceledLogin { self.message = "Could not open browser sign-in." }
                        return
                    }
                    do {
                        guard let callback, callback.scheme == APIConfiguration.callbackScheme, callback.host == "auth",
                              callback.path.isEmpty, let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                              parts.queryItems?.filter({ $0.name == "state" }).count == 1,
                              parts.queryItems?.first(where: { $0.name == "state" })?.value == state,
                              parts.queryItems?.filter({ $0.name == "code" }).count == 1,
                              let code = parts.queryItems?.first(where: { $0.name == "code" })?.value else {
                            throw FlowyError.message("Sign-in could not be verified. Please connect again.")
                        }
                        var request = URLRequest(url: config.endpoint("api/mac/token"))
                        request.httpMethod = "POST"
                        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                        request.httpBody = try JSONSerialization.data(withJSONObject: ["code": code, "verifier": verifier])
                        let transport = FlowyAPIClient.transport()
                        defer { transport.finishTasksAndInvalidate() }
                        var account = try FlowyAPIClient.decode(try await transport.data(for: request), as: SharedSession.self)
                        account.apiBaseURL = config.baseURL
                        try account.persist()
                        self.account = account
                    } catch { self.message = error.localizedDescription }
                }
            }
            webSession?.presentationContextProvider = self
            if webSession?.start() != true { busy = false; webSession = nil; message = "Could not open browser sign-in." }
        } catch { message = error.localizedDescription }
    }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApp.keyWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
    }
}
private extension Data {
    var base64URL: String { base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
}
