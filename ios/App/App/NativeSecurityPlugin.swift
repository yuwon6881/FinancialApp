import Capacitor
import LocalAuthentication
import UIKit

final class NativePrivacyCover {
    static let shared = NativePrivacyCover()

    private var coverView: UIView?

    func setHidden(_ hidden: Bool, completion: (() -> Void)? = nil) {
        let update = {
            guard let window = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap(\.windows)
                .first(where: \.isKeyWindow) else {
                completion?()
                return
            }

            if hidden {
                let cover = self.coverView ?? self.makeCoverView()
                cover.frame = window.bounds
                cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                if cover.superview !== window {
                    self.coverView?.removeFromSuperview()
                    window.addSubview(cover)
                }
                self.coverView = cover
            } else {
                self.coverView?.removeFromSuperview()
                self.coverView = nil
            }
            completion?()
        }
        if Thread.isMainThread { update() }
        else { DispatchQueue.main.async(execute: update) }
    }

    private func makeCoverView() -> UIView {
        let view = UIView()
        view.backgroundColor = UIColor(red: 11.0 / 255.0, green: 14.0 / 255.0, blue: 20.0 / 255.0, alpha: 1)
        view.isAccessibilityElement = true
        view.accessibilityLabel = "FinancialApp is locked"
        view.accessibilityViewIsModal = true
        return view
    }
}

@objc(NativeSecurityPlugin)
public final class NativeSecurityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSecurityPlugin"
    public let jsName = "NativeBiometrics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkBiometry", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHidden", returnType: CAPPluginReturnPromise),
    ]

    @objc func checkBiometry(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        call.resolve(["isAvailable": available, "deviceIsSecure": available])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let context = LAContext()
        context.localizedFallbackTitle = "Use Device Passcode"
        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: call.getString("reason") ?? "Verify your identity to open FinancialApp."
        ) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve()
                } else {
                    call.reject(error?.localizedDescription ?? "Device authentication was cancelled.", "authentication_failed", error)
                }
            }
        }
    }

    @objc func setHidden(_ call: CAPPluginCall) {
        guard let hidden = call.getBool("hidden") else {
            call.reject("A visibility value is required.")
            return
        }
        NativePrivacyCover.shared.setHidden(hidden) { call.resolve() }
    }
}
