import AppKit
import UniformTypeIdentifiers

@main
struct LoaderHarness {
    static func check(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        if !condition() { throw FlowyError.message(message) }
    }
    static func main() async throws {
        let loader = SharedItemLoader()
        defer { loader.cleanup() }
        let text = NSExtensionItem()
        text.attributedContentText = NSAttributedString(string: "Una nota ☕")
        let textItems = try await loader.load([text])
        try check(textItems.count == 1 && textItems[0].text == "Una nota ☕", "Text-only extension item lost content")
        let link = NSExtensionItem()
        link.attachments = [NSItemProvider(item: URL(string: "https://example.com/article")! as NSURL, typeIdentifier: UTType.url.identifier)]
        let urls = try await loader.load([link])
        try check(urls[0].type == .url && urls[0].url?.host == "example.com", "URL decoding failed")
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".pdf")
        try Data("%PDF-fixture".utf8).write(to: tmp)
        let file = NSExtensionItem()
        file.attachments = [NSItemProvider(item: tmp as NSURL, typeIdentifier: UTType.fileURL.identifier)]
        let files = try await loader.load([file])
        try FileManager.default.removeItem(at: tmp)
        try check(files[0].type == .pdf, "PDF type not retained")
        let preserved = try Data(contentsOf: files[0].fileURL!)
        try check(preserved == Data("%PDF-fixture".utf8), "Provider temporary file was not copied")
        let zip = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".zip")
        try Data("PK-fixture".utf8).write(to: zip)
        defer { try? FileManager.default.removeItem(at: zip) }
        let zipProvider = NSItemProvider()
        zipProvider.registerFileRepresentation(forTypeIdentifier: UTType.zip.identifier, fileOptions: [], visibility: .all) { completion in
            completion(zip, false, nil)
            return nil
        }
        let zipped = NSExtensionItem(); zipped.attachments = [zipProvider]
        let generic = try await loader.load([zipped])
        try check(generic[0].type == .file && generic[0].mimeType == "application/zip", "Generic representation failed")
        let tiff = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".tiff")
        defer { try? FileManager.default.removeItem(at: tiff) }
        let pixels = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 8, pixelsHigh: 8, bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 24, bitsPerPixel: 24)!
        try pixels.representation(using: .tiff, properties: [:])!.write(to: tiff)
        let imageItem = NSExtensionItem()
        imageItem.attachments = [NSItemProvider(item: tiff as NSURL, typeIdentifier: UTType.fileURL.identifier)]
        let images = try await loader.load([imageItem])
        try check(images[0].type == .image && images[0].mimeType == "image/jpeg", "TIFF conversion failed")
        let jpeg = try Data(contentsOf: images[0].fileURL!)
        try check(Array(jpeg.prefix(2)) == [0xff, 0xd8], "Converted bytes are not JPEG")
        let bad = NSExtensionItem()
        bad.attachments = [NSItemProvider(item: URL(string: "javascript:alert(1)")! as NSURL, typeIdentifier: UTType.url.identifier)]
        do { _ = try await loader.load([bad]); throw FlowyError.message("Unsafe URL accepted") }
        catch FlowyError.message(let message) { try check(message.contains("HTTP"), message) }
        let tooMany = Array(repeating: text, count: 11)
        do { _ = try await loader.load(tooMany); throw FlowyError.message("Too many items accepted") }
        catch FlowyError.message(let message) { try check(message.contains("10"), message) }
        let large = NSExtensionItem(); large.attributedContentText = NSAttributedString(string: String(repeating: "a", count: 256 * 1024 + 1))
        do { _ = try await loader.load([large]); throw FlowyError.message("Oversized text accepted") }
        catch FlowyError.message(let message) { try check(message.contains("256"), message) }
        loader.cleanup()
        try check(!FileManager.default.fileExists(atPath: loader.directory.path), "Temporary directory leaked")
        print("PASS: text, URL, PDF, generic file representation, TIFF to JPEG, temporary lifetime, unsafe URL, item/text limits, cleanup")
    }
}
