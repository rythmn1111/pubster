import Foundation

/// Typed endpoint wrappers mirroring the Phase-1 backend API surface
/// (docs/BACKEND.md). Auth-token persistence happens here on successful login.
extension APIClient {
    // MARK: - Auth

    @discardableResult
    func requestOtp(phone: String) async throws -> OkResponse {
        try await request(
            path: "auth/otp/request",
            method: "POST",
            jsonBody: OtpRequestBody(phone: phone)
        )
    }

    /// Verify the dummy OTP; on success the returned tokens are stored in the Keychain.
    func verifyOtp(phone: String, code: String, name: String?) async throws -> AuthResponse {
        let auth: AuthResponse = try await request(
            path: "auth/otp/verify",
            method: "POST",
            jsonBody: OtpVerifyBody(phone: phone, code: code, name: name)
        )
        tokenStore.save(accessToken: auth.accessToken, refreshToken: auth.refreshToken)
        return auth
    }

    func me() async throws -> UserDTO {
        try await request(path: "auth/me", authorized: true)
    }

    /// Best-effort server-side revoke, then always clears local tokens.
    func logout() async {
        if let refreshToken = tokenStore.refreshToken {
            let _: OkResponse? = try? await request(
                path: "auth/logout",
                method: "POST",
                jsonBody: LogoutBody(refreshToken: refreshToken)
            )
        }
        tokenStore.clear()
    }

    // MARK: - Pubs / Menu / Events

    func nearestPubs(
        lat: Double,
        lng: Double,
        radius: Double? = nil,
        limit: Int? = nil
    ) async throws -> [PubSummaryDTO] {
        var query = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lng", value: String(lng)),
        ]
        if let radius { query.append(URLQueryItem(name: "radius", value: String(radius))) }
        if let limit { query.append(URLQueryItem(name: "limit", value: String(limit))) }
        return try await request(path: "pubs/nearest", query: query)
    }

    func pubDetail(id: String) async throws -> PubDetailDTO {
        try await request(path: "pubs/\(id)")
    }

    func menu(pubId: String) async throws -> [MenuCategoryDTO] {
        try await request(path: "pubs/\(pubId)/menu")
    }

    func events(pubId: String) async throws -> [EventDTO] {
        try await request(path: "pubs/\(pubId)/events")
    }

    // MARK: - Reservations

    func availability(pubId: String, date: String, partyCount: Int) async throws -> [AvailabilitySlotDTO] {
        try await request(
            path: "pubs/\(pubId)/availability",
            query: [
                URLQueryItem(name: "date", value: date),
                URLQueryItem(name: "partyCount", value: String(partyCount)),
            ]
        )
    }

    func createReservation(_ body: CreateReservationBody) async throws -> ReservationDTO {
        try await request(
            path: "reservations",
            method: "POST",
            jsonBody: body,
            authorized: true
        )
    }

    func myReservations() async throws -> [ReservationDTO] {
        try await request(path: "reservations/me", authorized: true)
    }

    @discardableResult
    func cancelReservation(id: String) async throws -> ReservationDTO {
        try await request(path: "reservations/\(id)/cancel", method: "POST", authorized: true)
    }
}
