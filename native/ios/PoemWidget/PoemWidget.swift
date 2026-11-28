import AppIntents
import CoreText
import SwiftUI
import UIKit
import WidgetKit

private final class PoemWidgetBundleToken {}

private enum PoemWidgetResources {
    static let bundle = Bundle(for: PoemWidgetBundleToken.self)
    static let fontName = "Huiwen-mincho"

    static let fontRegistered: Bool = {
        let candidates = [
            bundle.url(forResource: fontName, withExtension: "ttf"),
            Bundle.main.url(forResource: fontName, withExtension: "ttf")
        ]
        for case let url? in candidates {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            return true
        }
        return false
    }()

    static let iconImage: UIImage? = {
        let paths = [
            bundle.path(forResource: "poem-widget-icon", ofType: "png"),
            Bundle.main.path(forResource: "poem-widget-icon", ofType: "png")
        ]
        for case let path? in paths {
            if let image = UIImage(contentsOfFile: path) {
                return image
            }
        }
        return UIImage(named: "poem-widget-icon", in: bundle, compatibleWith: nil)
    }()

    static func font(size: CGFloat) -> Font {
        _ = fontRegistered
        return .custom(fontName, size: size)
    }
}

private struct PoemWidgetSwapIcon: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 24.0
        let sy = rect.height / 24.0
        let radius = 3.5 * min(sx, sy)
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }

        var path = Path()
        // Upper loop arrow (right-bottom -> top-right rounded corner -> left)
        path.move(to: pt(21, 15))
        path.addArc(tangent1End: pt(21, 6), tangent2End: pt(3.5, 6), radius: radius)
        path.addLine(to: pt(3.5, 6))
        path.move(to: pt(8, 1.5))
        path.addLine(to: pt(3.5, 6))
        path.addLine(to: pt(8, 10.5))

        // Lower loop arrow (left-top -> bottom-left rounded corner -> right)
        path.move(to: pt(3, 9))
        path.addArc(tangent1End: pt(3, 18), tangent2End: pt(20.5, 18), radius: radius)
        path.addLine(to: pt(20.5, 18))
        path.move(to: pt(16, 13.5))
        path.addLine(to: pt(20.5, 18))
        path.addLine(to: pt(16, 22.5))
        return path
    }
}

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
                .font(PoemWidgetResources.font(size: wide ? 20 : 17))
                .lineSpacing(3.5)
                .lineLimit(wide ? 4 : 5)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            if wide {
                HStack(spacing: 7) {
                    if let icon = PoemWidgetResources.iconImage {
                        brandIcon(icon)
                    }
                    if let poem = entry.poem {
                        Text(poem.title.isEmpty ? poem.author : "\(poem.author) · \(poem.title)")
                            .font(PoemWidgetResources.font(size: 12.5))
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
    private func brandIcon(_ icon: UIImage) -> some View {
        let base = Image(uiImage: icon)
            .renderingMode(.original)
            .resizable()
            .interpolation(.high)
            .antialiased(true)
            .scaledToFill()
            .frame(width: 22, height: 22)
            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            .accessibilityHidden(true)
        #if compiler(>=6.0)
        if #available(iOS 18.0, *) {
            base.widgetAccentedRenderingMode(.fullColor)
        } else {
            base
        }
        #else
        base
        #endif
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
        PoemWidgetSwapIcon()
            .stroke(ink, style: StrokeStyle(lineWidth: 1.55, lineCap: .round, lineJoin: .round))
            .frame(width: 17, height: 17)
            .padding(.horizontal, 8)
            .frame(minWidth: 36, minHeight: 44)
            .contentShape(Rectangle())
            .accessibilityLabel("换一首")
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
