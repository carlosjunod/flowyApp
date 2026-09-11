import Foundation

enum SharedItemType { case url, text, image, pdf, file }
struct SharedItem {
    let type: SharedItemType
    var text: String? = nil
    var url: URL? = nil
    var fileURL: URL? = nil
    var filename: String? = nil
    var mimeType: String? = nil
    var preview: String { filename ?? url?.host ?? text.map { String($0.prefix(120)) } ?? "Shared content" }
}
struct SavedFlowyItem: Decodable { let id: String }
enum FlowyError: LocalizedError {
    case message(String)
    var errorDescription: String? { switch self { case .message(let text): return text } }
}
