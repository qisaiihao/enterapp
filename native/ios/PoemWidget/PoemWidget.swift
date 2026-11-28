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
        return .custom(fontName, fixedSize: size)
    }

    static func measuringFont(size: CGFloat) -> UIFont {
        _ = fontRegistered
        return UIFont(name: fontName, size: size) ?? .systemFont(ofSize: size)
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
    @ScaledMetric(relativeTo: .body) private var fontScale: CGFloat = 1
    let entry: PoemWidgetEntry

    private static let lineSpacing: CGFloat = 3.5
    private static let attributionGap: CGFloat = 10
    private static let iconSize: CGFloat = 22
    private static let nextButtonWidth: CGFloat = 36
    private static let minimumTextScale: CGFloat = 0.85

    private var wide: Bool { family == .systemMedium }
    private var custom: Bool { entry.options.palette == "custom" }
    private var ink: Color {
        color(custom ? entry.options.textColor : entry.poem?.textColor, fallback: 0x302820)
    }
    private var paper: Color {
        color(custom ? entry.options.backgroundColor : entry.poem?.backgroundColor, fallback: 0xF5EFE5)
    }

    var body: some View {
        Group {
            if #available(iOS 17.0, *) {
                card.containerBackground(for: .widget) { paper }
            } else {
                card.padding(.horizontal, wide ? 19 : 15)
                    .padding(.vertical, 14)
                    .background(paper.ignoresSafeArea())
            }
        }
        .widgetURL(detailURL)
    }

    private var card: some View {
        GeometryReader { geometry in
            let authorSize = 12.5 * fontScale
            let authorHeight = wide ? ceil(PoemWidgetResources.measuringFont(size: authorSize).lineHeight) : 0
            let footerSpace = wide ? authorHeight + Self.attributionGap : 0
            let excerptSize = CGSize(width: geometry.size.width, height: max(0, geometry.size.height - footerSpace))

            VStack(alignment: .leading, spacing: Self.attributionGap) {
                excerpt(in: excerptSize)
                    .frame(width: excerptSize.width, height: excerptSize.height,
                           alignment: wide ? .topLeading : .leading)
                if wide {
                    attribution(fontSize: authorSize, height: authorHeight)
                }
            }
        }
        .foregroundColor(ink)
    }

    @ViewBuilder
    private func excerpt(in size: CGSize) -> some View {
        let text = entry.poem?.excerpt ?? entry.emptyText
        let fontSize = (wide ? 20 : 17) * fontScale
        let lineLimit = wide ? 4 : 5
        let font = PoemWidgetResources.measuringFont(size: fontSize)
        let textWidth: (String) -> CGFloat = { ($0 as NSString).size(withAttributes: [.font: font]).width }

        if size.width > 0, size.height > 0, entry.poem != nil,
           let rows = PoemWidgetVerse.rows(in: text, fitting: size.width / Self.minimumTextScale, measure: textWidth) {
            let candidates = rows.prefix(lineLimit)
            let widest = candidates.map(textWidth).max() ?? 0
            let scale = min(1, size.width / max(widest, 1), size.height / font.lineHeight)
            let fittedSize = fontSize * scale
            let lineHeight = ceil(font.withSize(fittedSize).lineHeight)
            let rowsThatFit = Int((size.height + Self.lineSpacing) / (lineHeight + Self.lineSpacing))
            let visibleRows = candidates.prefix(max(1, rowsThatFit))

            VStack(alignment: .leading, spacing: Self.lineSpacing) {
                ForEach(visibleRows.indices, id: \.self) { index in
                    Text(verbatim: visibleRows[index])
                        .font(PoemWidgetResources.font(size: fittedSize))
                        .lineLimit(1)
                        .minimumScaleFactor(Self.minimumTextScale)
                        .frame(height: lineHeight)
                }
            }
        } else {
            Text(verbatim: text)
                .font(PoemWidgetResources.font(size: fontSize))
                .lineSpacing(Self.lineSpacing)
                .lineLimit(lineLimit)
                .minimumScaleFactor(Self.minimumTextScale)
        }
    }

    private func attribution(fontSize: CGFloat, height: CGFloat) -> some View {
        let icon = PoemWidgetResources.iconImage
        let author = entry.poem.map { $0.title.isEmpty ? $0.author : "\($0.author) · \($0.title)" } ?? ""
        return Text(verbatim: author)
            .font(PoemWidgetResources.font(size: fontSize))
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: height)
            .padding(.leading, icon == nil ? 0 : Self.iconSize + 7)
            .padding(.trailing, entry.nextToken == nil ? 0 : Self.nextButtonWidth + 6)
            .overlay(alignment: .leading) {
                if let icon { brandIcon(icon) }
            }
            .overlay(alignment: .trailing) {
                if entry.nextToken != nil { nextButton }
            }
    }

    @ViewBuilder
    private func brandIcon(_ icon: UIImage) -> some View {
        let image = Image(uiImage: icon)
            .renderingMode(.original)
            .resizable()
            .interpolation(.high)
            .antialiased(true)
        #if compiler(>=6.0)
        if #available(iOS 18.0, *) {
            image
                .widgetAccentedRenderingMode(.fullColor)
                .scaledToFill()
                .frame(width: Self.iconSize, height: Self.iconSize)
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                .accessibilityHidden(true)
        } else {
            image
                .scaledToFill()
                .frame(width: Self.iconSize, height: Self.iconSize)
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                .accessibilityHidden(true)
        }
        #else
        image
            .scaledToFill()
            .frame(width: Self.iconSize, height: Self.iconSize)
            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            .accessibilityHidden(true)
        #endif
    }

    @ViewBuilder
    private var nextButton: some View {
        if #available(iOS 17.0, *) {
            Button(intent: NextWidgetPoem()) { nextLabel }.buttonStyle(.plain)
        } else if let legacyNextURL {
            Link(destination: legacyNextURL) { nextLabel }.buttonStyle(.plain)
        }
    }

    private var detailURL: URL? {
        guard let postId = entry.poem?.id, !postId.isEmpty else { return nil }
        var url = URLComponents(string: "poementer://poem-widget/detail")
        url?.queryItems = [URLQueryItem(name: "id", value: postId)]
        return url?.url
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
            .frame(minWidth: Self.nextButtonWidth, minHeight: 44)
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
