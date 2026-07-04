import Foundation

/// Money formatting. Backend stores/returns integer cents.
enum Money {
    static func format(cents: Int, currencyCode: String = "USD") -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        return formatter.string(from: NSNumber(value: Double(cents) / 100.0))
            ?? "$\(String(format: "%.2f", Double(cents) / 100.0))"
    }

    /// Compact, locale-stable price for the vibrant Discover UI: "$10", "$12.50",
    /// "Free". Uses en_US so hero/carousel labels stay clean regardless of the
    /// device region.
    static func compact(cents: Int) -> String {
        guard cents > 0 else { return "Free" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "en_US")
        formatter.maximumFractionDigits = cents % 100 == 0 ? 0 : 2
        return formatter.string(from: NSNumber(value: Double(cents) / 100.0))
            ?? "$\(cents / 100)"
    }
}

/// Date parsing/formatting helpers.
///
/// The backend treats pub opening hours (and the `date` query param) as
/// wall-clock UTC for the MVP (see services/api reservations service). To keep
/// displayed slot times consistent with that assumption, we format instants in
/// UTC as well.
enum DateUtils {
    private static let isoWithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// Parse an ISO-8601 timestamp (with or without fractional seconds).
    static func date(fromISO iso: String) -> Date? {
        isoWithFractional.date(from: iso) ?? isoPlain.date(from: iso)
    }

    /// `yyyy-MM-dd` in UTC — the format the availability endpoint expects.
    static let apiDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "h:mm a"
        return formatter
    }()

    private static let dateTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "EEE, MMM d · h:mm a"
        return formatter
    }()

    static func apiDate(from date: Date) -> String {
        apiDateFormatter.string(from: date)
    }

    static func timeLabel(fromISO iso: String) -> String {
        guard let date = date(fromISO: iso) else { return iso }
        return timeFormatter.string(from: date)
    }

    static func dateTimeLabel(fromISO iso: String) -> String {
        guard let date = date(fromISO: iso) else { return iso }
        return dateTimeFormatter.string(from: date)
    }
}

extension PubSummaryDTO {
    /// Human-friendly distance, e.g. "320 m" or "1.4 km".
    var distanceLabel: String {
        if distanceMeters < 1000 {
            return "\(Int(distanceMeters.rounded())) m"
        }
        return String(format: "%.1f km", distanceMeters / 1000)
    }

    var shortAddress: String {
        [addressLine, city].compactMap { $0 }.joined(separator: ", ")
    }
}
