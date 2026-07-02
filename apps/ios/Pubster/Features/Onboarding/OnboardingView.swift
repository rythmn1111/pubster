import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var locationManager: LocationManager
    @StateObject private var vm = OnboardingViewModel()

    var body: some View {
        ZStack {
            Color.pubsterAccent.opacity(0.06).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 28) {
                    switch vm.step {
                    case .phone:
                        phoneStep
                    case .otp:
                        otpStep
                    case .name:
                        nameStep
                    case .location:
                        locationStep
                    }
                }
                .padding(24)
                .frame(maxWidth: 520)
            }
        }
        .animation(.easeInOut, value: vm.step)
    }

    // MARK: - Steps

    private var phoneStep: some View {
        VStack(spacing: 24) {
            header(
                icon: "mug.fill",
                title: "Welcome to Pubster",
                subtitle: "Discover the best pubs and events happening near you."
            )
            VStack(alignment: .leading, spacing: 8) {
                Text("Phone number")
                    .font(.subheadline.weight(.semibold))
                TextField("+1 555 123 4567", text: $vm.phone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .modifier(FieldStyle())
            }
            errorText
            PrimaryButton(title: "Send code", isLoading: vm.isSubmitting) {
                Task { await vm.sendCode(api: appState.api) }
            }
            Text("We'll text you a verification code.\nDummy mode: any number works with code 000000.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
    }

    private var otpStep: some View {
        VStack(spacing: 24) {
            header(
                icon: "lock.shield.fill",
                title: "Enter your code",
                subtitle: "Sent to \(vm.normalizedPhone)"
            )
            VStack(alignment: .leading, spacing: 8) {
                Text("Verification code")
                    .font(.subheadline.weight(.semibold))
                TextField("000000", text: $vm.code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.title2.monospacedDigit())
                    .modifier(FieldStyle())
            }
            errorText
            PrimaryButton(title: "Verify", isLoading: vm.isSubmitting) {
                Task { await vm.verify(api: appState.api) }
            }
            Button("Change phone number") {
                vm.step = .phone
                vm.errorMessage = nil
            }
            .font(.footnote)
            Text("Dummy OTP is 000000.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var nameStep: some View {
        VStack(spacing: 24) {
            header(
                icon: "person.crop.circle.fill",
                title: "What's your name?",
                subtitle: "So pubs know who's booking."
            )
            VStack(alignment: .leading, spacing: 8) {
                Text("Name")
                    .font(.subheadline.weight(.semibold))
                TextField("Jane Doe", text: $vm.name)
                    .textContentType(.name)
                    .modifier(FieldStyle())
            }
            errorText
            PrimaryButton(title: "Continue", isLoading: vm.isSubmitting) {
                Task { await vm.submitName(api: appState.api) }
            }
        }
    }

    private var locationStep: some View {
        VStack(spacing: 24) {
            header(
                icon: "location.circle.fill",
                title: "Find pubs near you",
                subtitle: "Pubster uses your location to show the nearest pubs and sort them by distance."
            )
            errorText
            PrimaryButton(title: "Allow location access", isLoading: false) {
                locationManager.requestPermission()
            }
            Button("Maybe later") {
                finish()
            }
            .font(.subheadline.weight(.semibold))
        }
        .onChange(of: locationManager.authorizationStatus) { _, status in
            if status != .notDetermined {
                finish()
            }
        }
    }

    private func finish() {
        if let user = vm.verifiedUser {
            appState.completeLogin(with: user)
        } else {
            appState.phase = .main
        }
    }

    // MARK: - Building blocks

    private func header(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 52))
                .foregroundStyle(Color.pubsterAccent)
                .padding(.top, 32)
            Text(title)
                .font(.title.bold())
                .multilineTextAlignment(.center)
            Text(subtitle)
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var errorText: some View {
        if let message = vm.errorMessage {
            Text(message)
                .font(.footnote)
                .foregroundStyle(.red)
                .multilineTextAlignment(.center)
        }
    }
}

/// Rounded, filled text field style used across onboarding.
private struct FieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(14)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
            .autocorrectionDisabled()
    }
}

/// Full-width primary action button with an inline loading state.
struct PrimaryButton: View {
    let title: String
    var isLoading: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title)
                    .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView()
                        .tint(.white)
                }
            }
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.pubsterAccent, in: RoundedRectangle(cornerRadius: 12))
        }
        .disabled(isLoading)
    }
}
