import Foundation

/// Async/await networking layer over `URLSession`.
///
/// - Injects `Authorization: Bearer <accessToken>` on authorized requests.
/// - On a `401` for an authorized request, transparently refreshes via
///   `POST /auth/refresh` (single-flight) and retries the original request once.
/// - Decodes the canonical `{ error: { code, message } }` envelope into
///   ``APIError``.
///
/// Modelled as an `actor` so token reads/refresh are serialized without data
/// races. Typed endpoint wrappers live in `APIClient+Endpoints.swift`.
actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    let tokenStore: TokenStore
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    /// In-flight refresh, so concurrent 401s share a single refresh round-trip.
    private var refreshTask: Task<Void, Error>?

    init(baseURL: URL, tokenStore: TokenStore, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.tokenStore = tokenStore
        self.session = session
    }

    // MARK: - Request builders

    /// Core request entry point taking a pre-encoded JSON body (or none).
    func request<T: Decodable>(
        path: String,
        method: String = "GET",
        query: [URLQueryItem]? = nil,
        body: Data? = nil,
        authorized: Bool = false
    ) async throws -> T {
        let request = try makeRequest(path: path, method: method, query: query, body: body)
        return try await perform(request, authorized: authorized, allowRetry: true)
    }

    /// Convenience overload that JSON-encodes an `Encodable` body.
    func request<T: Decodable, Body: Encodable>(
        path: String,
        method: String,
        query: [URLQueryItem]? = nil,
        jsonBody: Body,
        authorized: Bool = false
    ) async throws -> T {
        let data = try encoder.encode(jsonBody)
        return try await request(path: path, method: method, query: query, body: data, authorized: authorized)
    }

    private func makeRequest(
        path: String,
        method: String,
        query: [URLQueryItem]?,
        body: Data?
    ) throws -> URLRequest {
        guard var components = URLComponents(string: baseURL.absoluteString + "/" + path) else {
            throw APIError.invalidURL
        }
        if let query, !query.isEmpty {
            components.queryItems = query
        }
        guard let url = components.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    // MARK: - Perform + retry

    private func perform<T: Decodable>(
        _ request: URLRequest,
        authorized: Bool,
        allowRetry: Bool
    ) async throws -> T {
        var attempt = request
        if authorized {
            guard let token = tokenStore.accessToken else { throw APIError.unauthorized }
            attempt.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: attempt)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if http.statusCode == 401, authorized, allowRetry {
            try await refreshTokens()
            return try await perform(request, authorized: authorized, allowRetry: false)
        }

        guard (200..<300).contains(http.statusCode) else {
            throw decodeError(data, status: http.statusCode)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func decodeError(_ data: Data, status: Int) -> APIError {
        if let envelope = try? decoder.decode(ApiErrorEnvelope.self, from: data) {
            return .server(status: status, code: envelope.error.code, message: envelope.error.message)
        }
        return .server(
            status: status,
            code: "HTTP_\(status)",
            message: HTTPURLResponse.localizedString(forStatusCode: status)
        )
    }

    // MARK: - Token refresh (single-flight)

    private func refreshTokens() async throws {
        if let existing = refreshTask {
            try await existing.value
            return
        }
        let task = Task { try await self.doRefresh() }
        refreshTask = task
        defer { refreshTask = nil }
        try await task.value
    }

    private func doRefresh() async throws {
        guard let refreshToken = tokenStore.refreshToken else {
            throw APIError.unauthorized
        }
        let request = try makeRequest(
            path: "auth/refresh",
            method: "POST",
            query: nil,
            body: try encoder.encode(RefreshBody(refreshToken: refreshToken))
        )
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            tokenStore.clear()
            throw APIError.unauthorized
        }
        guard let pair = try? decoder.decode(TokenPair.self, from: data) else {
            tokenStore.clear()
            throw APIError.unauthorized
        }
        tokenStore.save(accessToken: pair.accessToken, refreshToken: pair.refreshToken)
    }
}
