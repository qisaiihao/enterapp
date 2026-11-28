import Foundation

enum PoemWidgetVerse {
    private static let clausePattern = try! NSRegularExpression(
        pattern: #"\h*(?:\p{Han}\p{M}*){7}(?:\h*[，。！？；、：,.!?;:…]+[”’」』）)]*|(?=\h|$))"#
    )

    static func rows(in excerpt: String, fitting width: CGFloat, measure: (String) -> CGFloat) -> [String]? {
        let lines = excerpt.split(omittingEmptySubsequences: false, whereSeparator: \.isNewline)
        var rows: [String] = []
        for (index, sourceLine) in lines.enumerated() {
            if sourceLine.allSatisfy(\.isWhitespace) {
                rows.append("")
                continue
            }

            let line = String(sourceLine)
            let matches = clausePattern.matches(in: line, range: NSRange(line.startIndex..., in: line))
            var consumed = line.startIndex
            var row = ""
            for match in matches {
                guard let range = Range(match.range, in: line), range.lowerBound == consumed else { return nil }
                let clause = line[range]
                let combined = row + clause
                if !row.isEmpty, measure(combined) > width {
                    rows.append(row)
                    row = clause.trimmingCharacters(in: .whitespaces)
                } else {
                    row = combined
                }
                consumed = range.upperBound
            }

            let tail = line[consumed...]
            if !tail.allSatisfy(\.isWhitespace) {
                // The feed can end with an ellipsis after part of a verse.
                guard index == lines.count - 1, !rows.isEmpty || !row.isEmpty,
                      tail.range(of: #"^\h*(?:\p{Han}\p{M}*){0,6}…$"#, options: .regularExpression) != nil else {
                    return nil
                }
            }
            if !row.isEmpty { rows.append(row) }
        }
        return rows.contains { !$0.isEmpty } ? rows : nil
    }
}
