import Foundation

// MARK: - Featured event (pairs an event with its pub for display)

/// A curated event surfaced in the Discover carousel / Event Detail screen.
/// Pairs the backend `EventDTO` with the `PubSummaryDTO` that hosts it plus a
/// gradient index for visual variety. When real API wiring lands, the events
/// feed can populate this same shape with minimal change.
struct FeaturedEvent: Identifiable, Equatable {
    let id: String
    let event: EventDTO
    let pub: PubSummaryDTO
    let gradientIndex: Int

    var coverLabel: String {
        event.coverChargeCents > 0
            ? "\(Money.compact(cents: event.coverChargeCents)) cover"
            : "Free entry"
    }
}

// MARK: - Navigation routes

/// Value-based routes for the Discover navigation stack. Both Event Detail and
/// Pub Detail push onto the same stack, so `EventDetailView`'s CTA can navigate
/// straight into the existing pub-detail / reserve flow.
enum DiscoverRoute: Hashable {
    case event(String)               // FeaturedEvent id
    case pub(id: String, name: String)
}

// MARK: - Mock data (first cut — no backend required)

/// Curated sample data for the redesign first cut. Structured to match the real
/// DTOs so a live events/pubs feed can be swapped in later.
enum MockData {
    /// Build an ISO-8601 (UTC) timestamp relative to now, at a wall-clock hour.
    private static func iso(inDays days: Int, hour: Int, minute: Int = 0) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let base = cal.date(byAdding: .day, value: days, to: Date()) ?? Date()
        let at = cal.date(bySettingHour: hour, minute: minute, second: 0, of: base) ?? base
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: at)
    }

    // ~4 nearby pubs, sorted by distance.
    static let pubs: [PubSummaryDTO] = [
        PubSummaryDTO(
            id: "pub-copper-tap", name: "The Copper Tap",
            description: "Craft beer & live music in a neon-lit corner bar.",
            latitude: 42.3611, longitude: -71.0570,
            addressLine: "18 Beacon St", city: "Boston", region: "MA", postalCode: "02108",
            photos: [], distanceMeters: 320
        ),
        PubSummaryDTO(
            id: "pub-harbor-vine", name: "Harbor & Vine",
            description: "Waterfront cocktail lounge with a jazz residency.",
            latitude: 42.3554, longitude: -71.0510,
            addressLine: "9 Long Wharf", city: "Boston", region: "MA", postalCode: "02110",
            photos: [], distanceMeters: 810
        ),
        PubSummaryDTO(
            id: "pub-neon-alley", name: "Neon Alley",
            description: "Rooftop bar, DJs and sunset views over the city.",
            latitude: 42.3489, longitude: -71.0812,
            addressLine: "441 Tremont St", city: "Boston", region: "MA", postalCode: "02116",
            photos: [], distanceMeters: 1_240
        ),
        PubSummaryDTO(
            id: "pub-alembic", name: "The Alembic",
            description: "Cozy gastropub famous for trivia and small-batch gin.",
            latitude: 42.3730, longitude: -71.1180,
            addressLine: "77 Mass Ave", city: "Cambridge", region: "MA", postalCode: "02139",
            photos: [], distanceMeters: 2_150
        ),
    ]

    private static func pub(_ id: String) -> PubSummaryDTO {
        pubs.first { $0.id == id } ?? pubs[0]
    }

    // ~5 sample events, each with a distinct gradient.
    static let featuredEvents: [FeaturedEvent] = [
        FeaturedEvent(
            id: "evt-indie-night",
            event: EventDTO(
                id: "evt-indie-night", name: "Indie Night Live",
                description: "Three rising local bands take over the back room for a night of guitar-driven indie rock. Doors at 7:30, first set at 8.",
                startTime: iso(inDays: 0, hour: 20), endTime: iso(inDays: 0, hour: 23),
                capacity: 120, coverChargeCents: 1000
            ),
            pub: pub("pub-copper-tap"), gradientIndex: 0
        ),
        FeaturedEvent(
            id: "evt-rooftop-sunset",
            event: EventDTO(
                id: "evt-rooftop-sunset", name: "Rooftop Sunset Sessions",
                description: "Golden-hour DJ sets, frozen cocktails and skyline views. Free entry all evening — arrive early for a spot on the deck.",
                startTime: iso(inDays: 1, hour: 18), endTime: iso(inDays: 1, hour: 22),
                capacity: 90, coverChargeCents: 0
            ),
            pub: pub("pub-neon-alley"), gradientIndex: 1
        ),
        FeaturedEvent(
            id: "evt-jazz-cocktails",
            event: EventDTO(
                id: "evt-jazz-cocktails", name: "Jazz & Cocktails",
                description: "An intimate late-night jazz quartet paired with the bar's signature barrel-aged cocktails. Reserved seating recommended.",
                startTime: iso(inDays: 3, hour: 21), endTime: iso(inDays: 3, hour: 23, minute: 30),
                capacity: 60, coverChargeCents: 1500
            ),
            pub: pub("pub-harbor-vine"), gradientIndex: 2
        ),
        FeaturedEvent(
            id: "evt-trivia-champs",
            event: EventDTO(
                id: "evt-trivia-champs", name: "Trivia Championship",
                description: "The monthly finals. Teams of up to six, six rounds, and a bar tab for the winners. Free to play.",
                startTime: iso(inDays: 4, hour: 19), endTime: iso(inDays: 4, hour: 22),
                capacity: 80, coverChargeCents: 0
            ),
            pub: pub("pub-alembic"), gradientIndex: 3
        ),
        FeaturedEvent(
            id: "evt-vinyl-brunch",
            event: EventDTO(
                id: "evt-vinyl-brunch", name: "Vinyl Sunday Brunch",
                description: "Bottomless mimosas and a rotating cast of vinyl selectors spinning soul, funk and disco all afternoon.",
                startTime: iso(inDays: 6, hour: 11), endTime: iso(inDays: 6, hour: 15),
                capacity: 100, coverChargeCents: 500
            ),
            pub: pub("pub-copper-tap"), gradientIndex: 4
        ),
    ]
}
