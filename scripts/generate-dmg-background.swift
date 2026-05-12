import AppKit
import Foundation

let fileManager = FileManager.default
let root = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let outputURL = root.appendingPathComponent("src-tauri/dmg/background.png")

let width = 456
let height = 276
let size = NSSize(width: width, height: height)

let image = NSImage(size: size)
image.lockFocus()

let bgPath = NSBezierPath(rect: NSRect(origin: .zero, size: size))
NSColor(calibratedRed: 0.965, green: 0.955, blue: 0.935, alpha: 1.0).setFill()
bgPath.fill()

// Soft vertical paper tint.
let paperGradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.98, green: 0.97, blue: 0.95, alpha: 1.0),
  NSColor(calibratedRed: 0.95, green: 0.94, blue: 0.92, alpha: 1.0),
])!
paperGradient.draw(in: NSRect(origin: .zero, size: size), angle: -90)

// Very subtle receipt-like fiber texture.
for _ in 0..<520 {
  let x = CGFloat.random(in: 0...CGFloat(width))
  let y = CGFloat.random(in: 0...CGFloat(height))
  let alpha = CGFloat.random(in: 0.015...0.035)
  NSColor(calibratedWhite: CGFloat.random(in: 0.72...0.86), alpha: alpha).setFill()
  NSBezierPath(rect: NSRect(x: x, y: y, width: 1.0, height: 1.0)).fill()
}

// Light horizontal print-like micro-lines.
for y in stride(from: 10, through: height - 10, by: 9) {
  let line = NSBezierPath()
  line.move(to: NSPoint(x: 24, y: CGFloat(y)))
  line.line(to: NSPoint(x: CGFloat(width - 24), y: CGFloat(y)))
  line.lineWidth = 0.4
  NSColor(calibratedWhite: 0.70, alpha: 0.05).setStroke()
  line.stroke()
}

let fugitFont =
  NSFont(name: "Courier Prime Bold", size: 44)
  ?? NSFont(name: "CourierPrime-Bold", size: 44)
  ?? NSFont(name: "Courier-Bold", size: 44)
  ?? NSFont.monospacedSystemFont(ofSize: 44, weight: .bold)

let titleAttributes: [NSAttributedString.Key: Any] = [
  .font: fugitFont,
  .foregroundColor: NSColor(calibratedRed: 0.12, green: 0.12, blue: 0.12, alpha: 0.98),
  .kern: 1.2,
]

let title = NSAttributedString(string: "Fugit", attributes: titleAttributes)
let titleSize = title.size()
let titlePoint = NSPoint(
  x: (CGFloat(width) - titleSize.width) / 2,
  y: CGFloat(height) * 0.72 - (titleSize.height / 2)
)
title.draw(at: titlePoint)

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Failed to generate DMG background image.\n", stderr)
  exit(1)
}

try? fileManager.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
do {
  try png.write(to: outputURL)
  print("Generated: \(outputURL.path)")
} catch {
  fputs("Write failed: \(error)\n", stderr)
  exit(1)
}
