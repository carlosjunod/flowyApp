import Foundation

// Do not forward credentials or shared content through server redirects.
final class NoRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
struct APIEnvelope<T: Decodable>: Decodable { let data: T?; let error: String? }
struct FlowyAPIClient {
    let configuration: APIConfiguration
    static func transport() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 90
        config.httpCookieStorage = nil
        config.urlCache = nil
        return URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    }
    func save(item: SharedItem) async throws -> SavedFlowyItem {
        guard let account = try SharedSession.load(configuration: configuration) else {
            throw FlowyError.message("Connect Flowy first. Open Flowy once to connect your account.")
        }
        var request = URLRequest(url: configuration.endpoint("api/mac/capture"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(account.token)", forHTTPHeaderField: "Authorization")
        let session = Self.transport()
        defer { session.finishTasksAndInvalidate() }
        let result: (Data, URLResponse)
        if let file = item.fileURL {
            return try await saveFile(file, item: item, token: account.token, session: session)
        } else {
            let payload: [String: String]
            if let url = item.url { payload = ["type": "url", "url": url.absoluteString] }
            else if let text = item.text { payload = ["type": "text", "text": text] }
            else { throw FlowyError.message("No supported content was received.") }
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            result = try await session.data(for: request)
        }
        return try Self.decode(result, as: SavedFlowyItem.self)
    }
    private func saveFile(_ file: URL, item: SharedItem, token: String, session: URLSession) async throws -> SavedFlowyItem {
        let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        let mime = item.mimeType ?? "application/octet-stream", name = item.filename ?? file.lastPathComponent
        let cap = APIConfiguration.fileLimit(name: name, mime: mime)
        guard size > 0, size <= cap else { throw FlowyError.message("The file exceeds the limit for this format.") }
        struct Ticket: Decodable { let index: Int; let url: URL; let headers: [String: String] }
        struct Upload: Decodable { let itemId: String; let uploads: [Ticket] }
        var reserve = URLRequest(url: configuration.endpoint("api/files/uploads"))
        reserve.httpMethod = "POST"; reserve.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); reserve.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let type = mime.hasPrefix("image/") ? "screenshot" : (mime == "application/pdf" || name.lowercased().hasSuffix(".pdf")) ? "pdf" : "file"
        reserve.httpBody = try JSONSerialization.data(withJSONObject: ["type": type, "requestId": item.uploadRequestId, "files": [["name": name, "mime": mime, "size": size]]])
        let upload = try Self.decode(try await session.data(for: reserve), as: Upload.self)
        for ticket in upload.uploads {
            guard ticket.index == 0, ticket.url.scheme == "https" else { throw FlowyError.message("Invalid upload destination.") }
            var put = URLRequest(url: ticket.url); put.httpMethod = "PUT"
            ticket.headers.forEach { put.setValue($0.value, forHTTPHeaderField: $0.key) }
            let (_, response) = try await session.upload(for: put, fromFile: file)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw FlowyError.message("The upload did not finish. Try again.") }
        }
        var complete = URLRequest(url: configuration.endpoint("api/files/uploads/\(upload.itemId)/complete"))
        complete.httpMethod = "POST"; complete.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return try Self.decode(try await session.data(for: complete), as: SavedFlowyItem.self)
    }

    static func decode<T: Decodable>(_ result: (Data, URLResponse), as: T.Type) throws -> T {
        guard let response = result.1 as? HTTPURLResponse else { throw FlowyError.message("Couldn't reach Flowy.") }
        switch response.statusCode {
        case 401: throw FlowyError.message("Your session expired. Open Flowy to reconnect your account.")
        case 403: throw FlowyError.message("Open Flowy on the web and review your AI processing consent before saving.")
        case 413: throw FlowyError.message("The file or batch exceeds its limit, or your storage is full. Check Storage in Flowy.")
        case 429: throw FlowyError.message("Please wait a moment before trying again.")
        default: break
        }
        guard (200..<300).contains(response.statusCode),
              let envelope = try? JSONDecoder().decode(APIEnvelope<T>.self, from: result.0), let value = envelope.data else {
            throw FlowyError.message("Couldn't save or connect. Check your connection and try again.")
        }
        return value
    }
}
