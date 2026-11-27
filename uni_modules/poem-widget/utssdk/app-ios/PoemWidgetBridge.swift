import Foundation
import WidgetKit

public class PoemWidgetBridge {
    public static func isAvailable() -> Bool {
        guard #available(iOS 15.0, *), PoemWidgetFiles.container != nil,
              let extensionURL = Bundle.main.builtInPlugInsURL?.appendingPathComponent("PoemWidget.appex") else { return false }
        return FileManager.default.fileExists(atPath: extensionURL.path)
    }

    public static func readSettings() -> String {
        guard let data = PoemWidgetFiles.read(PoemWidgetFiles.settingsFile) else { return "{}" }
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    public static func writeSettings(_ json: String) -> Bool {
        guard #available(iOS 14.0, *), isAvailable(), let data = json.data(using: .utf8),
              (try? JSONDecoder().decode(PoemWidgetSettings.self, from: data)) != nil,
              PoemWidgetFiles.write(data, to: PoemWidgetFiles.settingsFile) else { return false }
        WidgetCenter.shared.reloadTimelines(ofKind: PoemWidgetFiles.kind)
        return true
    }

    public static func readPreview(_ rawSize: String) -> String {
        guard let size = PoemWidgetSize(rawValue: rawSize),
              let poem = PoemWidgetFiles.state(for: size, source: PoemWidgetFiles.options(for: size).source).current(at: Date()),
              let data = try? JSONEncoder().encode(poem) else { return "{}" }
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    public static func requestNext(_ token: String) -> Bool {
        guard #available(iOS 14.0, *), isAvailable(), UUID(uuidString: token) != nil else { return false }
        let source = PoemWidgetFiles.options(for: .wide).source
        let state = PoemWidgetFiles.state(for: .wide, source: source)
        let data = Data(token.utf8)
        guard state.selectionToken == token, state.canAdvance(at: Date()) else { return false }
        if PoemWidgetFiles.read(PoemWidgetFiles.legacyRequestFile) == data { return true }
        guard PoemWidgetFiles.write(data, to: PoemWidgetFiles.legacyRequestFile) else { return false }
        WidgetCenter.shared.reloadTimelines(ofKind: PoemWidgetFiles.kind)
        return true
    }
}
