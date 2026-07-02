import Foundation

/// Static app configuration. The API base URL is read from the `APIBaseURL`
/// Info.plist key (populated from the `API_BASE_URL` build setting), so it can
/// be pointed at a different backend per build config / CI without code changes.
/// Falls back to the local dev API if the key is missing or unsubstituted.
enum AppConfig {
    static let defaultBaseURLString = "http://localhost:4000/api/v1"

    static var apiBaseURL: URL {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        // Guard against a missing value or an unsubstituted "$(API_BASE_URL)".
        if !raw.isEmpty, !raw.contains("$("), let url = URL(string: raw) {
            return url
        }
        return URL(string: defaultBaseURLString)!
    }
}
