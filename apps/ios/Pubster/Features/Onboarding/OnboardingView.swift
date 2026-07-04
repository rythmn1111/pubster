import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var locationManager: LocationManager
    @StateObject private var vm = OnboardingViewModel()

    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView {
                VStack(spacing: Spacing.xxl) {
                    Group {
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
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
                }
                .padding(Spacing.xxl)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
        }
        .animation(.easeInOut, value: vm.step)
    }

    // MARK: - Steps

    private var phoneStep: some View {
        VStack(spacing: Spacing.xxl) {
            header(
                icon: "mug.fill",
                title: "Welcome to Pubster",
                subtitle: "Discover the best pubs and events happening near you."
            )
            LabeledField(label: "Phone number") {
                TextField("+1 555 123 4567", text: $vm.phone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
            }
            errorText
            PrimaryButton(title: "Send code", isLoading: vm.isSubmitting) {
                Task { await vm.sendCode(api: appState.api) }
            }
            hint("We'll text you a verification code.\nDummy mode: any number works with code 000000.")
        }
    }

    private var otpStep: some View {
        VStack(spacing: Spacing.xxl) {
            header(
                icon: "lock.shield.fill",
                title: "Enter your code",
                subtitle: "Sent to \(vm.normalizedPhone)"
            )
            LabeledField(label: "Verification code") {
                TextField("000000", text: $vm.code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.system(size: 22, weight: .semibold, design: .rounded).monospacedDigit())
            }
            errorText
            PrimaryButton(title: "Verify", isLoading: vm.isSubmitting) {
                Task { await vm.verify(api: appState.api) }
            }
            TextButton("Change phone number") {
                vm.step = .phone
                vm.errorMessage = nil
            }
            hint("Dummy OTP is 000000.")
        }
    }

    private var nameStep: some View {
        VStack(spacing: Spacing.xxl) {
            header(
                icon: "person.crop.circle.fill",
                title: "What's your name?",
                subtitle: "So pubs know who's booking."
            )
            LabeledField(label: "Name") {
                TextField("Jane Doe", text: $vm.name)
                    .textContentType(.name)
            }
            errorText
            PrimaryButton(title: "Continue", isLoading: vm.isSubmitting) {
                Task { await vm.submitName(api: appState.api) }
            }
        }
    }

    private var locationStep: some View {
        VStack(spacing: Spacing.xxl) {
            header(
                icon: "location.circle.fill",
                title: "Find pubs near you",
                subtitle: "Pubster uses your location to show the nearest pubs and sort them by distance."
            )
            errorText
            PrimaryButton(title: "Allow location access") {
                locationManager.requestPermission()
            }
            TextButton("Maybe later") {
                finish()
            }
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
        VStack(spacing: Spacing.lg) {
            ZStack {
                Circle()
                    .fill(LinearGradient.pubAccentGradient)
                    .frame(width: 56, height: 56)
                    .softShadow(radius: 12, y: 6, opacity: 0.18)
                Image(systemName: icon)
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .padding(.top, Spacing.xxl)
            Text(title)
                .font(.pubTitle)
                .foregroundStyle(Color.pubEspresso)
                .multilineTextAlignment(.center)
            Text(subtitle)
                .font(.pubBody)
                .foregroundStyle(Color.pubTextSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(.pubCaption)
            .multilineTextAlignment(.center)
            .foregroundStyle(Color.pubTextSecondary.opacity(0.85))
    }

    @ViewBuilder
    private var errorText: some View {
        if let message = vm.errorMessage {
            Text(message)
                .font(.pubCaption)
                .foregroundStyle(Color.pubError)
                .multilineTextAlignment(.center)
        }
    }
}
