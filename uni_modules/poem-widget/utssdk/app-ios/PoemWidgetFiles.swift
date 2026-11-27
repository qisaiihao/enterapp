import Foundation

enum PoemWidgetSize: String {
    case compact
    case wide
}

struct PoemWidgetOptions: Codable {
    var source = "original"
    var palette = "poem"
    var backgroundColor = "#F5EFE5"
    var textColor = "#302820"
}

struct PoemWidgetSettings: Codable {
    let compact: PoemWidgetOptions
    let wide: PoemWidgetOptions
}

struct WidgetPoem: Codable {
    let id: String
    let excerpt: String
    let title: String
    let author: String
    let backgroundColor: String
    let textColor: String
}

struct PoemWidgetFeedResponse: Codable {
    let source: String
    let day: String
    let poems: [WidgetPoem]
}

enum PoemWidgetClock {
    static let retryInterval: TimeInterval = 3600
    private static let zone = TimeZone(secondsFromGMT: 8 * 3600)!

    static func day(_ date: Date) -> String {
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_US_POSIX")
        format.timeZone = zone
        format.dateFormat = "yyyy-MM-dd"
        return format.string(from: date)
    }

    static func nextMidnight(_ date: Date) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar.startOfDay(for: date).addingTimeInterval(24 * retryInterval)
    }
}

struct PoemWidgetState: Codable {
    let source: String
    var day = ""
    var attemptedAt = Date.distantPast
    var fetchedAt = Date.distantPast
    var poems: [WidgetPoem] = []
    var selectedId = ""
    var selectionToken = ""

    func needsRefresh(at now: Date) -> Bool {
        let today = PoemWidgetClock.day(now)
        if PoemWidgetClock.day(attemptedAt) != today || attemptedAt > now { return true }
        return (day != today || poems.count < 2)
            && now.timeIntervalSince(attemptedAt) >= PoemWidgetClock.retryInterval
    }

    func current(at now: Date) -> WidgetPoem? {
        let fresh = source == "today"
            ? day == PoemWidgetClock.day(now)
            : now.timeIntervalSince(fetchedAt) < 48 * PoemWidgetClock.retryInterval
        return fresh ? poems.first { $0.id == selectedId } : nil
    }

    func canAdvance(at now: Date) -> Bool {
        current(at: now) != nil && poems.contains { $0.id != selectedId }
    }

    mutating func apply(_ feed: PoemWidgetFeedResponse?, at now: Date) {
        attemptedAt = now
        guard let feed, feed.source == source, feed.day == PoemWidgetClock.day(now) else { return }

        let keepSelection = day == feed.day && feed.poems.contains { $0.id == selectedId }
        poems = feed.poems
        day = feed.day
        fetchedAt = now
        if !keepSelection {
            selectedId = differentPoem()?.id ?? poems.first?.id ?? ""
            selectionToken = UUID().uuidString
        }
    }

    mutating func advance(at now: Date) {
        guard canAdvance(at: now), let poem = differentPoem() else { return }
        selectedId = poem.id
        selectionToken = UUID().uuidString
    }

    private func differentPoem() -> WidgetPoem? {
        poems.filter { $0.id != selectedId }.randomElement()
    }
}

enum PoemWidgetFiles {
    static let kind = "PoementerPoemWidget"
    static let group = "group.com.poementer.app.widgets"
    static let settingsFile = "poem-widget-settings.json"
    static let legacyRequestFile = "poem-widget-next"
    static var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    }

    static func read(_ name: String) -> Data? {
        guard let path = container?.appendingPathComponent(name) else { return nil }
        return try? Data(contentsOf: path)
    }

    @discardableResult
    static func write(_ data: Data, to name: String) -> Bool {
        guard let path = container?.appendingPathComponent(name) else { return false }
        do {
            try data.write(to: path, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    static func options(for size: PoemWidgetSize) -> PoemWidgetOptions {
        guard let data = read(settingsFile),
              let settings = try? JSONDecoder().decode(PoemWidgetSettings.self, from: data) else {
            return PoemWidgetOptions()
        }
        return size == .wide ? settings.wide : settings.compact
    }

    static func state(for size: PoemWidgetSize, source: String) -> PoemWidgetState {
        guard let data = read(stateName(size)),
              let state = try? JSONDecoder().decode(PoemWidgetState.self, from: data),
              state.source == source else {
            return PoemWidgetState(source: source)
        }
        return state
    }

    static func save(_ state: PoemWidgetState, for size: PoemWidgetSize) {
        if let data = try? JSONEncoder().encode(state) { write(data, to: stateName(size)) }
    }

    private static func stateName(_ size: PoemWidgetSize) -> String {
        "poem-widget-\(size.rawValue).json"
    }
}
