import Foundation

@MainActor
final class PubDetailViewModel: ObservableObject {
    @Published var detail: PubDetailDTO?
    @Published var menu: [MenuCategoryDTO] = []
    @Published var events: [EventDTO] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load(api: APIClient, pubId: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        async let detailResult = api.pubDetail(id: pubId)
        async let menuResult = api.menu(pubId: pubId)
        async let eventsResult = api.events(pubId: pubId)

        do {
            detail = try await detailResult
            menu = (try? await menuResult) ?? []
            events = (try? await eventsResult) ?? []
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
