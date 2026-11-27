import Foundation
import WidgetKit

struct PoemWidgetEntry: TimelineEntry {
    let date: Date
    let options: PoemWidgetOptions
    let poem: WidgetPoem?
    let emptyText: String
    let nextToken: String?

    static let preview = PoemWidgetEntry(
        date: Date(), options: PoemWidgetOptions(),
        poem: WidgetPoem(id: "preview", excerpt: "风翻过书页，\n把一行诗留给清晨。", title: "", author: "poementer",
                         backgroundColor: "#F5EFE5", textColor: "#302820"),
        emptyText: "", nextToken: nil
    )

    init(date: Date, options: PoemWidgetOptions, poem: WidgetPoem?, emptyText: String, nextToken: String?) {
        self.date = date
        self.options = options
        self.poem = poem
        self.emptyText = emptyText
        self.nextToken = nextToken
    }

    init(now: Date, options: PoemWidgetOptions, state: PoemWidgetState, size: PoemWidgetSize) {
        let message: String
        if state.day == PoemWidgetClock.day(now) {
            message = options.source == "today" ? "今日还没有新诗" : "暂无可显示的诗句"
        } else {
            message = state.attemptedAt == .distantPast ? "诗句正在加载" : "诗句暂未加载"
        }
        self.init(date: now, options: options, poem: state.current(at: now), emptyText: message,
                  nextToken: size == .wide && state.canAdvance(at: now) ? state.selectionToken : nil)
    }
}

actor PoemWidgetTimeline {
    static let shared = PoemWidgetTimeline()
    private static let endpoint = "https://cloud1-5gb0pbyl400845f5-1378788263.ap-shanghai.app.tcloudbase.com/poem-widget/feed"
    private var requests: [String: Task<PoemWidgetFeedResponse?, Never>] = [:]

    func advance() {
        let source = PoemWidgetFiles.options(for: .wide).source
        var state = PoemWidgetFiles.state(for: .wide, source: source)
        state.advance(at: Date())
        PoemWidgetFiles.save(state, for: .wide)
    }

    func timeline(for size: PoemWidgetSize) async -> Timeline<PoemWidgetEntry> {
        let options = PoemWidgetFiles.options(for: size)
        var state = PoemWidgetFiles.state(for: size, source: options.source)
        let requestedAt = Date()
        let requestedDay = PoemWidgetClock.day(requestedAt)
        if state.needsRefresh(at: requestedAt) {
            let key = "\(options.source):\(requestedDay)"
            let request = requests[key] ?? Task { await Self.load(options.source) }
            requests[key] = request
            let feed = await request.value
            requests[key] = nil
            let now = Date()
            let currentOptions = PoemWidgetFiles.options(for: size)
            if currentOptions.source != options.source || PoemWidgetClock.day(now) != requestedDay {
                return await timeline(for: size)
            }
            state = PoemWidgetFiles.state(for: size, source: currentOptions.source)
            if state.attemptedAt < requestedAt || state.attemptedAt > now {
                state.apply(feed, at: now)
                PoemWidgetFiles.save(state, for: size)
            }
        }

        let now = Date()
        if size == .wide, !state.selectionToken.isEmpty, state.canAdvance(at: now),
           PoemWidgetFiles.read(PoemWidgetFiles.legacyRequestFile) == Data(state.selectionToken.utf8) {
            state.advance(at: now)
            PoemWidgetFiles.save(state, for: size)
        }
        let currentOptions = PoemWidgetFiles.options(for: size)
        if currentOptions.source != state.source { return await timeline(for: size) }
        let entry = PoemWidgetEntry(now: now, options: currentOptions, state: state, size: size)
        let midnight = PoemWidgetClock.nextMidnight(now)
        let hasAlternativesToday = state.day == PoemWidgetClock.day(now) && state.canAdvance(at: now)
        let retry = max(state.attemptedAt.addingTimeInterval(PoemWidgetClock.retryInterval), now.addingTimeInterval(300))
        return Timeline(entries: [entry], policy: .after(hasAlternativesToday ? midnight : min(midnight, retry)))
    }

    private static func load(_ source: String) async -> PoemWidgetFeedResponse? {
        guard var url = URLComponents(string: endpoint) else { return nil }
        url.queryItems = [URLQueryItem(name: "source", value: source)]
        guard let address = url.url else { return nil }
        var request = URLRequest(url: address, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForResource = 10
        let session = URLSession(configuration: configuration)
        defer { session.finishTasksAndInvalidate() }
        return await withCheckedContinuation { continuation in
            session.dataTask(with: request) { data, response, _ in
                guard (response as? HTTPURLResponse)?.statusCode == 200, let data,
                      data.count <= 64 * 1024 else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: try? JSONDecoder().decode(PoemWidgetFeedResponse.self, from: data))
            }.resume()
        }
    }
}

struct PoemWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> PoemWidgetEntry { .preview }

    func getSnapshot(in context: Context, completion: @escaping (PoemWidgetEntry) -> Void) {
        if context.isPreview {
            completion(.preview)
            return
        }
        let size: PoemWidgetSize = context.family == .systemMedium ? .wide : .compact
        let options = PoemWidgetFiles.options(for: size)
        completion(PoemWidgetEntry(now: Date(), options: options,
                                   state: PoemWidgetFiles.state(for: size, source: options.source), size: size))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PoemWidgetEntry>) -> Void) {
        let size: PoemWidgetSize = context.family == .systemMedium ? .wide : .compact
        Task { completion(await PoemWidgetTimeline.shared.timeline(for: size)) }
    }
}
