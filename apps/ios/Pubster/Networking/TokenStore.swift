import Foundation
import Security

/// Persists the access + refresh tokens in the iOS Keychain (generic password
/// items). Keychain access is thread-safe, so this is safe to touch from the
/// `APIClient` actor.
final class TokenStore {
    private let service: String
    private let accessAccount = "accessToken"
    private let refreshAccount = "refreshToken"

    init(service: String = "com.pubster.app.tokens") {
        self.service = service
    }

    var accessToken: String? { read(accessAccount) }
    var refreshToken: String? { read(refreshAccount) }
    var hasTokens: Bool { accessToken != nil && refreshToken != nil }

    func save(accessToken: String, refreshToken: String) {
        write(accessToken, account: accessAccount)
        write(refreshToken, account: refreshAccount)
    }

    func clear() {
        delete(accessAccount)
        delete(refreshAccount)
    }

    // MARK: - Keychain helpers

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private func write(_ value: String, account: String) {
        let data = Data(value.utf8)
        SecItemDelete(baseQuery(account: account) as CFDictionary)
        var attributes = baseQuery(account: account)
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    private func read(_ account: String) -> String? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private func delete(_ account: String) {
        SecItemDelete(baseQuery(account: account) as CFDictionary)
    }
}
