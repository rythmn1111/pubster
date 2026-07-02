import Foundation

/// Errors surfaced by ``APIClient``. `server` carries the backend's canonical
/// `{ error: { code, message } }` envelope when present.
enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case server(status: Int, code: String, message: String)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The request URL was invalid."
        case .invalidResponse:
            return "The server returned an unexpected response."
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case let .server(_, _, message):
            return message
        case .decoding:
            return "Couldn't read the server response."
        case let .transport(error):
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain,
               nsError.code == NSURLErrorCannotConnectToHost || nsError.code == NSURLErrorCannotFindHost {
                return "Can't reach the Pubster server. Is the API running?"
            }
            return error.localizedDescription
        }
    }
}
