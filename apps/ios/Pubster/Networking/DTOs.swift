import Foundation

// Codable DTOs mirroring the Pubster backend wire contracts
// (services/api/src/modules/* + packages/shared). Timestamps are ISO-8601 UTC
// strings; money is integer cents.

// MARK: - Auth

struct OtpRequestBody: Encodable {
    let phone: String
}

struct OtpVerifyBody: Encodable {
    let phone: String
    let code: String
    let name: String?
}

struct RefreshBody: Encodable {
    let refreshToken: String
}

struct LogoutBody: Encodable {
    let refreshToken: String
}

struct OkResponse: Decodable {
    let ok: Bool
}

enum UserRole: String, Codable {
    case consumer
    case staff
    case manager
    case super_admin
}

struct UserDTO: Codable, Identifiable, Equatable {
    let id: String
    let role: UserRole
    let name: String?
    let phone: String?
    let email: String?
    let pubId: String?
}

struct TokenPair: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let user: UserDTO
}

// MARK: - Pubs / Menu / Events

typealias OpeningHours = [String: [[String]]]

struct PubSummaryDTO: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let description: String?
    let latitude: Double
    let longitude: Double
    let addressLine: String?
    let city: String?
    let region: String?
    let postalCode: String?
    let photos: [String]
    let distanceMeters: Double
}

struct PubDetailDTO: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let description: String?
    let latitude: Double
    let longitude: Double
    let addressLine: String?
    let city: String?
    let region: String?
    let postalCode: String?
    let phone: String?
    let photos: [String]
    let openingHours: OpeningHours?
    let slotMinutes: Int
}

struct MenuItemDTO: Decodable, Identifiable, Equatable {
    let id: String
    let categoryId: String
    let name: String
    let description: String?
    let priceCents: Int
    let imageUrl: String?
    let isAvailable: Bool
    let sortOrder: Int
}

struct MenuCategoryDTO: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let sortOrder: Int
    let items: [MenuItemDTO]
}

struct EventDTO: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let description: String?
    let startTime: String
    let endTime: String
    let capacity: Int
    let coverChargeCents: Int
}

// MARK: - Reservations & availability

enum ReservationStatus: String, Codable {
    case pending
    case confirmed
    case seated
    case completed
    case cancelled
    case no_show
}

struct AvailabilitySlotDTO: Decodable, Identifiable, Equatable {
    let startTime: String
    let endTime: String
    let available: Bool
    let seats: Int?

    var id: String { startTime }
}

struct CreateReservationBody: Encodable {
    let pubId: String
    let startTime: String
    let partyCount: Int
    let eventId: String?
}

struct ReservationDTO: Decodable, Identifiable, Equatable {
    let id: String
    let pubId: String
    let pubName: String?
    let userId: String
    let partyCount: Int
    let seats: Int
    let startTime: String
    let endTime: String
    let status: ReservationStatus
    let eventId: String?
    let createdAt: String
}

// MARK: - Error envelope

/// Canonical backend error shape: `{ error: { code, message, details? } }`.
struct ApiErrorEnvelope: Decodable {
    struct Body: Decodable {
        let code: String
        let message: String
    }
    let error: Body
}
