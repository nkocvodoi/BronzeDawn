import AppKit
import DawnCore
import SpriteKit

// Bronze Dawn: a Stone Age real-time strategy game for macOS.
//
//   BronzeDawn                                play
//   BronzeDawn --seed 42                      play a given map
//   BronzeDawn --simulate [--seed N]          AI against AI with no window, prints the result
//   BronzeDawn --snapshot out.png [--seconds 300] [--reveal]   render one frame to a PNG and quit

let args = CommandLine.arguments
func argValue(_ flag: String) -> String? {
    guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
    return args[i + 1]
}
let seed = argValue("--seed").flatMap(UInt64.init) ?? UInt64.random(in: 1...999_999)

let rules: Rules
do { rules = try Rules.locate() } catch {
    FileHandle.standardError.write("Bronze Dawn: \(error)\n".data(using: .utf8)!)
    exit(2)
}

if args.contains("--simulate") {
    let mins = argValue("--minutes").flatMap(Double.init) ?? 45
    let a = argValue("--ai1").flatMap(Difficulty.init(rawValue:)) ?? .hard
    let b = argValue("--ai2").flatMap(Difficulty.init(rawValue:)) ?? .easy
    let r = Simulation.run(rules: rules, seed: seed, minutes: mins, difficulties: [a, b])
    print("seed \(seed), \(a.rawValue) vs \(b.rawValue): " + (r.winner.map { "AI \($0 + 1) wins" } ?? "no winner")
          + " at \(Simulation.clock(r.seconds))")
    r.lines.forEach { print("  " + $0) }
    r.problems.forEach { print("  problem: " + $0) }
    exit(r.problems.isEmpty ? 0 : 1)
}

/// Passes pinch-to-zoom through to the scene.
final class GameView: SKView {
    override func magnify(with event: NSEvent) { scene?.magnify(with: event) }
    override var acceptsFirstResponder: Bool { true }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var view: GameView!
    var scene: GameScene!

    func applicationDidFinishLaunching(_ note: Notification) {
        let frame = NSRect(x: 0, y: 0, width: 1280, height: 800)
        window = NSWindow(contentRect: frame, styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Bronze Dawn"
        window.collectionBehavior = [.fullScreenPrimary]
        window.minSize = NSSize(width: 1024, height: 640)
        view = GameView(frame: frame)
        view.ignoresSiblingOrder = true
        view.preferredFramesPerSecond = 60
        if args.contains("--fps") { view.showsFPS = true; view.showsNodeCount = true }
        scene = GameScene(size: frame.size, rules: rules, seed: seed)
        view.presentScene(scene)
        window.contentView = view
        window.center()
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(view)
        NSApp.activate(ignoringOtherApps: true)
        setUpMenu()
        if let out = argValue("--snapshot") { snapshot(to: out) }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    private func setUpMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Bronze Dawn", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
            .keyEquivalentModifierMask = [.command, .control]
        appMenu.addItem(withTitle: "Quit Bronze Dawn", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        NSApp.mainMenu = main
    }

    /// Plays a few minutes with an AI on both sides, then saves what the screen shows.
    private func snapshot(to path: String) {
        let seconds = argValue("--seconds").flatMap(Double.init) ?? 240
        scene.start(.normal)
        scene.world.ais.append(AIController(player: 0, difficulty: .normal))
        for _ in 0..<Int(seconds / World.dt) { scene.world.step() }
        scene.world.events.removeAll()
        scene.revealMap = args.contains("--reveal")
        if let id = argValue("--select").flatMap(Int.init) { scene.selection = [id] }
        else if let v = scene.world.units(of: 0).first(where: \.isVillager) { scene.selection = [v.id] }
        if let z = argValue("--zoom").flatMap(Double.init) { scene.cam.setScale(CGFloat(z)) }
        if args.contains("--home") { scene.selectTownCenter() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            guard let tex = self.view.texture(from: self.scene) else { print("no texture"); exit(1) }
            let img = tex.cgImage()
            let rep = NSBitmapImageRep(cgImage: img)
            try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
            print("wrote \(path) \(img.width)x\(img.height)")
            exit(0)
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
