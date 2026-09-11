import Foundation
import Security

struct SharedSession: Codable {
    let token: String
    let userID: String
    let email: String
    var apiBaseURL: URL?
    static func load(configuration: APIConfiguration) throws -> SharedSession? {
        guard let data = try KeychainStore.read() else { return nil }
        let session = try JSONDecoder().decode(Self.self, from: data)
        guard session.apiBaseURL == configuration.baseURL, !session.token.isEmpty else { return nil }
        return session
    }
    func persist() throws { try KeychainStore.write(JSONEncoder().encode(self)) }
    static func disconnect() throws { try KeychainStore.remove() }
}

enum KeychainStore {
    private static func query() throws -> [String: Any] {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "FlowyKeychainGroup") as? String,
              !group.contains("$(") else { throw FlowyError.message("Keychain signing configuration is missing.") }
        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: "app.tryflowy.mac.session",
                kSecAttrAccount as String: "current-account",
                kSecAttrAccessGroup as String: group,
                kSecUseDataProtectionKeychain as String: true]
    }
    static func read() throws -> Data? {
        var query = try query()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }
        try check(status)
        return value as? Data
    }
    static func write(_ data: Data) throws {
        let query = try query()
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            try check(SecItemAdd(item as CFDictionary, nil))
        } else { try check(status) }
    }
    static func remove() throws {
        let status = SecItemDelete(try query() as CFDictionary)
        if status != errSecItemNotFound { try check(status) }
    }
    private static func check(_ status: OSStatus) throws {
        guard status == errSecSuccess else { throw FlowyError.message("Could not access the secure session (\(status)). Unlock your Mac and check app signing.") }
    }
}
