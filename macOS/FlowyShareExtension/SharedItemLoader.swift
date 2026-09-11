import AppKit
import UniformTypeIdentifiers
import ImageIO

struct SharedItemLoader: Sendable {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("Flowy-share-\(UUID().uuidString)", isDirectory: true)
    func cleanup() { try? FileManager.default.removeItem(at: directory) }
    func load(_ input: [NSExtensionItem]) async throws -> [SharedItem] {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        var items: [SharedItem] = []
        for entry in input {
            let providers = entry.attachments ?? []
            if providers.isEmpty, let text = entry.attributedContentText?.string, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                items.append(try textItem(text))
            }
            for provider in providers {
                try Task.checkCancellation()
                guard items.count < APIConfiguration.maxItems else { throw FlowyError.message("Share up to 10 items at a time.") }
                items.append(try await load(provider))
            }
        }
        guard !items.isEmpty, items.count <= APIConfiguration.maxItems else { throw FlowyError.message("No supported content was received, or more than 10 items were shared.") }
        return items
    }
    private func textItem(_ text: String) throws -> SharedItem {
        guard text.utf8.count <= 256 * 1024 else { throw FlowyError.message("Shared text exceeds 256 KB.") }
        return SharedItem(type: .text, text: text)
    }
    private func load(_ provider: NSItemProvider) async throws -> SharedItem {
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            // Copy while the provider callback still owns the source URL.
            return try await withCheckedThrowingContinuation { continuation in
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { value, error in
                    do {
                        if let error { throw error }
                        guard let url = Self.url(value), url.isFileURL else { throw FlowyError.message("Could not read the shared file.") }
                        continuation.resume(returning: try self.copy(url, type: nil, name: url.lastPathComponent))
                    } catch { continuation.resume(throwing: error) }
                }
            }
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            let url: URL = try await withCheckedThrowingContinuation { continuation in
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { value, error in
                    if let error { continuation.resume(throwing: error) }
                    else if let url = Self.url(value) { continuation.resume(returning: url) }
                    else { continuation.resume(throwing: FlowyError.message("Could not read the shared link.")) }
                }
            }
            guard ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil,
                  url.user == nil, url.password == nil else { throw FlowyError.message("Only HTTP and HTTPS links can be saved.") }
            return SharedItem(type: .url, url: url)
        }
        // Prefer actual binary representations over a source app's textual caption.
        if let identifier = provider.registeredTypeIdentifiers.first(where: {
            guard let type = UTType($0) else { return false }
            return type.conforms(to: .image) || type.conforms(to: .pdf)
        }) { return try await representation(provider, identifier: identifier) }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            let text: String = try await withCheckedThrowingContinuation { continuation in
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { value, error in
                    if let error { continuation.resume(throwing: error) }
                    else if let text = value as? String { continuation.resume(returning: text) }
                    else if let text = value as? NSAttributedString { continuation.resume(returning: text.string) }
                    else if let data = value as? Data, let text = String(data: data, encoding: .utf8) { continuation.resume(returning: text) }
                    else { continuation.resume(throwing: FlowyError.message("Could not read the shared text.")) }
                }
            }
            return try textItem(text)
        }
        if let identifier = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .data) == true }) {
            return try await representation(provider, identifier: identifier)
        }
        throw FlowyError.message("This app did not provide a supported link, text or file.")
    }
    private func representation(_ provider: NSItemProvider, identifier: String) async throws -> SharedItem {
        let suggestedName = provider.suggestedName
        return try await withCheckedThrowingContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: identifier) { url, error in
                do {
                    if let error { throw error }
                    guard let url else { throw FlowyError.message("The shared file is unavailable.") }
                    let type = UTType(identifier)
                    var name = suggestedName ?? url.lastPathComponent
                    if URL(fileURLWithPath: name).pathExtension.isEmpty, let ext = type?.preferredFilenameExtension { name += ".\(ext)" }
                    continuation.resume(returning: try self.copy(url, type: type, name: name))
                } catch { continuation.resume(throwing: error) }
            }
        }
    }
    private static func url(_ value: NSSecureCoding?) -> URL? {
        if let url = value as? URL { return url }
        if let text = value as? String { return URL(string: text) }
        if let data = value as? Data { return URL(dataRepresentation: data, relativeTo: nil) }
        return nil
    }
    private func copy(_ source: URL, type: UTType?, name: String) throws -> SharedItem {
        let access = source.startAccessingSecurityScopedResource()
        defer { if access { source.stopAccessingSecurityScopedResource() } }
        let values = try source.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentTypeKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true else { throw FlowyError.message("Share individual files. Folders and aliases are not supported.") }
        guard let size = values.fileSize, size > 0, size <= APIConfiguration.maxFileBytes else { throw FlowyError.message("Files must be between 1 byte and 5 MB.") }
        let destination = directory.appendingPathComponent(UUID().uuidString)
        FileManager.default.createFile(atPath: destination.path, contents: nil, attributes: [.posixPermissions: 0o600])
        let input = try FileHandle(forReadingFrom: source), output = try FileHandle(forWritingTo: destination)
        defer { try? input.close(); try? output.close() }
        var copied = 0
        while let chunk = try input.read(upToCount: 64 * 1024), !chunk.isEmpty {
            copied += chunk.count
            guard copied <= APIConfiguration.maxFileBytes else { throw FlowyError.message("File exceeds 5 MB.") }
            try output.write(contentsOf: chunk)
        }
        let resolved = type ?? values.contentType ?? UTType(filenameExtension: source.pathExtension)
        let kind: SharedItemType = resolved?.conforms(to: .image) == true ? .image : resolved?.conforms(to: .pdf) == true ? .pdf : .file
        if kind == .image, !["image/jpeg", "image/png", "image/gif", "image/webp"].contains(resolved?.preferredMIMEType ?? "") {
            // Photos/Preview often offer HEIC or TIFF; the backend's Vision input
            // accepts JPEG/PNG/GIF/WebP. Downsample during decode to bound memory.
            let jpeg = directory.appendingPathComponent(UUID().uuidString + ".jpg")
            guard let source = CGImageSourceCreateWithURL(destination as CFURL, nil),
                  let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceThumbnailMaxPixelSize: 2048,
                    kCGImageSourceShouldCacheImmediately: false,
                  ] as CFDictionary),
                  let encoder = CGImageDestinationCreateWithURL(jpeg as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
                throw FlowyError.message("Could not convert this image. Try sharing a PNG or JPEG.")
            }
            CGImageDestinationAddImage(encoder, image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
            guard CGImageDestinationFinalize(encoder) else { throw FlowyError.message("Could not prepare the image.") }
            return SharedItem(type: .image, fileURL: jpeg, filename: (name as NSString).deletingPathExtension + ".jpg", mimeType: "image/jpeg")
        }
        return SharedItem(type: kind, fileURL: destination, filename: name, mimeType: resolved?.preferredMIMEType ?? "application/octet-stream")
    }
}
