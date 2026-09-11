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
            let boundary = "Flowy-\(UUID().uuidString)"
            let body = try multipart(file: file, item: item, boundary: boundary)
            defer { try? FileManager.default.removeItem(at: body) }
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            result = try await session.upload(for: request, fromFile: body)
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
    static func decode<T: Decodable>(_ result: (Data, URLResponse), as: T.Type) throws -> T {
        guard let response = result.1 as? HTTPURLResponse else { throw FlowyError.message("Couldn't reach Flowy.") }
        switch response.statusCode {
        case 401: throw FlowyError.message("Your session expired. Open Flowy to reconnect your account.")
        case 403: throw FlowyError.message("Open Flowy on the web and review your AI processing consent before saving.")
        case 413: throw FlowyError.message("This file is too large. The Mac integration accepts files up to 5 MB.")
        case 429: throw FlowyError.message("Please wait a moment before trying again.")
        default: break
        }
        guard (200..<300).contains(response.statusCode),
              let envelope = try? JSONDecoder().decode(APIEnvelope<T>.self, from: result.0), let value = envelope.data else {
            throw FlowyError.message("Couldn't save or connect. Check your connection and try again.")
        }
        return value
    }
    private func multipart(file: URL, item: SharedItem, boundary: String) throws -> URL {
        let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size > 0, size <= APIConfiguration.maxFileBytes else { throw FlowyError.message("Files must be between 1 byte and 5 MB.") }
        let body = FileManager.default.temporaryDirectory.appendingPathComponent("Flowy-upload-\(UUID().uuidString)")
        FileManager.default.createFile(atPath: body.path, contents: nil, attributes: [.posixPermissions: 0o600])
        do {
            let output = try FileHandle(forWritingTo: body)
            defer { try? output.close() }
            let name = (item.filename ?? "Shared file").replacingOccurrences(of: "[^a-zA-Z0-9._ -]", with: "_", options: .regularExpression)
            let mime = item.mimeType ?? "application/octet-stream"
            try output.write(contentsOf: Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(name)\"\r\nContent-Type: \(mime)\r\n\r\n".utf8))
            let input = try FileHandle(forReadingFrom: file)
            defer { try? input.close() }
            var copied = 0
            while let chunk = try input.read(upToCount: 64 * 1024), !chunk.isEmpty {
                copied += chunk.count
                guard copied <= APIConfiguration.maxFileBytes else { throw FlowyError.message("File exceeds 5 MB.") }
                try output.write(contentsOf: chunk)
            }
            try output.write(contentsOf: Data("\r\n--\(boundary)--\r\n".utf8))
            return body
        } catch { try? FileManager.default.removeItem(at: body); throw error }
    }
}
