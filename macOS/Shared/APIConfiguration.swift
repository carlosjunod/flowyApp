import Foundation

struct APIConfiguration {
    let baseURL: URL
    let environment: String
    let apiVersion = "1"
    static let maxFileBytes = 5 * 1024 * 1024
    static let maxItems = 10
    static let callbackScheme = "flowy-mac"
    static var current: APIConfiguration {
        get throws {
            guard let raw = Bundle.main.object(forInfoDictionaryKey: "FlowyAPIBaseURL") as? String,
                  let url = URL(string: raw), url.scheme == "https", url.host != nil,
                  url.user == nil, url.password == nil, url.query == nil, url.fragment == nil else {
                throw FlowyError.message("Invalid API configuration. Use an HTTPS server address.")
            }
            return APIConfiguration(baseURL: url, environment: Bundle.main.object(forInfoDictionaryKey: "FlowyEnvironment") as? String ?? "production")
        }
    }
    func endpoint(_ path: String) -> URL { baseURL.appendingPathComponent(path) }
}
