import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 17.0, *)
struct NextWidgetPoem: AppIntent {
    static var title: LocalizedStringResource = "换一首"
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await PoemWidgetTimeline.shared.advance()
        return .result()
    }
}

struct PoemWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PoemWidgetEntry

    private var wide: Bool { family == .systemMedium }
    private var custom: Bool { entry.options.palette == "custom" }
    private var ink: Color {
        color(custom ? entry.options.textColor : entry.poem?.textColor, fallback: 0x302820)
    }
    private var paper: Color {
        color(custom ? entry.options.backgroundColor : entry.poem?.backgroundColor, fallback: 0xF5EFE5)
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            card.containerBackground(for: .widget) { paper }
        } else {
            card.padding(.horizontal, wide ? 19 : 15)
                .padding(.top, 14)
                .padding(.bottom, wide ? 4 : 14)
                .background(paper.ignoresSafeArea())
                .widgetURL(legacyNextURL)
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(entry.poem?.excerpt ?? entry.emptyText)
                .font(.system(size: wide ? 20 : 17, design: .serif))
                .lineSpacing(3)
                .lineLimit(wide ? 4 : 5)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            if wide {
                HStack(spacing: 7) {
                    Image("poem-widget-icon")
                        .resizable()
                        .frame(width: 22, height: 22)
                        .clipShape(RoundedRectangle(cornerRadius: 5))
                        .accessibilityHidden(true)
                    if let poem = entry.poem {
                        Text(poem.title.isEmpty ? poem.author : "\(poem.author) · \(poem.title)")
                            .font(.system(size: 12))
                            .lineLimit(1)
                    }
                    Spacer(minLength: 6)
                    if entry.nextToken != nil {
                        nextButton
                    }
                }
                .frame(height: 44)
            }
        }
        .foregroundColor(ink)
    }

    @ViewBuilder
    private var nextButton: some View {
        if #available(iOS 17.0, *) {
            Button(intent: NextWidgetPoem()) { nextLabel }.buttonStyle(.plain)
        } else {
            nextLabel
        }
    }

    private var legacyNextURL: URL? {
        guard wide, let token = entry.nextToken else { return nil }
        return URL(string: "poementer://poem-widget/next?token=\(token)")
    }

    private var nextLabel: some View {
        Text("换一首")
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 8)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
    }

    private func color(_ hex: String?, fallback: UInt32) -> Color {
        let value = hex.flatMap { $0.count == 7 && $0.hasPrefix("#") ? UInt32($0.dropFirst(), radix: 16) : nil } ?? fallback
        return Color(red: Double((value >> 16) & 255) / 255,
                     green: Double((value >> 8) & 255) / 255,
                     blue: Double(value & 255) / 255)
    }
}

@main
struct PoementerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: PoemWidgetFiles.kind, provider: PoemWidgetProvider()) { entry in
            PoemWidgetView(entry: entry)
        }
        .configurationDisplayName("桌面诗歌")
        .description("选一首诗放在桌面，每天读一首。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
