# Bronze Dawn

Game chiến thuật thời gian thực (RTS) thời kỳ đồ đá cho macOS, lấy cảm hứng từ
lối chơi của Đế chế 1. Đây là bản clean-room: chỉ làm lại cơ chế chơi. Tên,
hình vẽ, số liệu và code đều là của dự án này, không lấy bất cứ thứ gì từ game gốc.

"Bronze Dawn" chỉ là tên tạm. Hãy chạy `/replica-brand` để đặt tên thật trước khi phát hành.

## Chạy game

Cần macOS 13 trở lên và Xcode (hoặc Command Line Tools).

```bash
swift run -c release BronzeDawn          # chơi ngay
./scripts/make-app.sh                     # đóng gói build/Bronze Dawn.app (universal, ad-hoc signed)
open "build/Bronze Dawn.app"
```

Khi vào game, bấm 1, 2 hoặc 3 để chọn độ khó Dễ, Thường hoặc Khó.

## Chơi trên trình duyệt

Bản web nằm trong thư mục `web/`, dùng TypeScript và PixiJS. Bản web chơi theo luật đầy đủ kiểu Đế chế 1: 4 thời đại
(Stone, Tool, Bronze, Iron), 33 loại quân, 21 công trình, 65 công nghệ, 16 dân tộc, săn thú, đánh cá, thầy tu cải đạo,
tường thành, Wonder. Luật nằm trong `data/rules.json`, sinh ra từ `scripts/gen-rules.py`. Bản Mac giữ bộ luật 2 thời đại
trong `data/rules-mac.json`. Toàn bộ hình là pixel art vẽ bằng code; xem tất cả ở `gallery.html` khi chạy `npm run dev`.

```bash
cd web
npm install
npm run dev          # mở http://localhost:5173
npm test             # 16 test của phần mô phỏng, gồm 2 trận AI đấu AI
npm run sim          # AI đấu AI không cần trình duyệt
npm run build && npm run smoke   # chơi thử tự động bằng chuột và phím thật trên Chrome
```

Mỗi lần push lên `main`, workflow `.github/workflows/web.yml` sẽ test, build rồi đăng lên GitHub Pages.
Chủ repo cần bật một lần: **Settings → Pages → Source: GitHub Actions**. Thêm `?seed=42` vào URL để chơi lại đúng một bản đồ.

## Cách chơi

Bạn bắt đầu với 1 Town Center và 3 dân làng (villager). Nhiệm vụ: thu thập
tài nguyên, xây nhà, lên Tool Age rồi tiêu diệt đối thủ.

| Thao tác | Tác dụng |
| --- | --- |
| Chuột trái / kéo | Chọn / chọn theo vùng. Giữ Shift để chọn thêm, double-click để chọn mọi unit cùng loại trên màn hình |
| Chuột phải | Đi, thu hoạch, xây, tấn công. Khi đang chọn công trình: đặt điểm tập kết (rally point) |
| Villager: B rồi một chữ (web, như Đế chế) | B mở menu xây; E House, G Granary, S Storage Pit, B Barracks, M Market, F Farm, A Archery Range, L Stable, W Wall, T Tower, C Government Center, P Temple, Y Academy, K Siege Workshop, N Town Center, O Wonder; Esc quay lại |
| Công trình (web) | C Villager, T Clubman/Bowman/Hoplite/Priest, Z kiếm sĩ, S Scout, C Cavalry, R chariot, E voi, A lên đời ở Town Center; Esc hủy |
| Lính: S / A | Dừng / Attack-move |
| Map size (web) | Chọn Small 72, Medium 96, Large 120, Huge 144, Gigantic 200 ở màn hình bắt đầu |
| Tùy chọn trận (web) | Màn hình bắt đầu: kiểu bản đồ (9 kiểu), cách thắng (chuẩn, chỉ chinh phục, theo điểm, hết giờ), thời đại khởi đầu, tài nguyên (Low đến Death Match), giới hạn dân số, mở bản đồ, Ruins và Artifact |
| Diplomacy (web) | Nút Diplomacy trên thanh trên cùng: đặt đồng minh / trung lập / kẻ thù với từng người, gửi cống nạp 100 mỗi loại tài nguyên |
| Ruins, Artifact (web) | Đưa một unit đến gần để chiếm; Artifact của bạn bấm chuột phải để di chuyển, chở được bằng thuyền. Giữ hết một loại 15 phút là thắng |
| H, `.` | Về Town Center, chọn villager đang rảnh |
| Cmd+1..9, 1..9 | Lưu và gọi nhóm quân (trên web: Ctrl hoặc Alt+1..9) |
| Mũi tên, trackpad, pinch, PageUp/PageDown | Cuộn và zoom bản đồ (bản Mac: + - để zoom) |
| + / - (web) | Tốc độ game 1x, 1.5x, 2x, 3x như setting của Đế chế; bấm vào ô tốc độ trên thanh trên cùng cũng được |
| F1 (web: ? hoặc nút Menu), F3 (bản Mac: P), Delete | Hướng dẫn, tạm dừng, phá unit hoặc công trình đã chọn |

Các mẹo:
- Thức ăn ban đầu lấy từ bụi dâu. Khi dâu hết thì xây Farm (cần Granary trước).
- Muốn lên Tool Age cần 500 food và 2 loại công trình khác nhau (không tính House và Town Center).
- Thế khắc chế: cung thủ (Bowman) thắng bộ binh, kỵ binh (Scout) thắng cung thủ, bộ binh thắng kỵ binh. Bộ binh có thêm sát thương lên công trình.

## Cấu trúc

```
data/rules.json          mọi con số trong game. Sửa ở đây là cân bằng lại game, không cần build lại
Sources/DawnCore/        mô phỏng (không dùng SpriteKit): luật, bản đồ, A*, sương mù, AI
Sources/BronzeDawn/      SpriteKit: hình vẽ bằng code, HUD, điều khiển
Tests/DawnCoreTests/     unit test và một trận AI đấu AI chạy headless
web/                     bản trình duyệt: src/core (mô phỏng, port từ DawnCore), src/game (PixiJS + HUD HTML)
replica/game/design.md   tài liệu thiết kế (viết theo /replica-game-design)
replica/features.csv     ma trận tính năng, chấm điểm bằng /replica-diff
```

## Kiểm tra

```bash
swift test                                                         # 15 test, gồm một trận AI đấu AI trọn vẹn
swift run -c release BronzeDawn --simulate --seed 3 --ai1 hard --ai2 easy
python3 ../replica-skill/replica-game-design/balance.py data/rules.json   # tam giác khắc chế
python3 ../replica-skill/replica-diff/parity.py replica/features.csv        # độ phủ tính năng
swift run BronzeDawn --snapshot shot.png --seconds 600 --reveal            # chụp một khung hình
```

## Phát hành cho máy Mac khác

`make-app.sh` chỉ ký ad-hoc, nên bản build chỉ chạy được trên máy này. Muốn
phân phối, ký bằng Developer ID rồi notarize:

```bash
codesign --force --options runtime --sign "Developer ID Application: <tên>" "build/Bronze Dawn.app"
ditto -c -k --keepParent "build/Bronze Dawn.app" BronzeDawn.zip
xcrun notarytool submit BronzeDawn.zip --apple-id <email> --team-id <team> --wait
xcrun stapler staple "build/Bronze Dawn.app"
```

## Việc tiếp theo

Bronze Age và Iron Age, công nghệ nâng cấp, âm thanh, săn thú, tường thành,
dân tộc với bonus riêng. Xem [replica/features.csv](replica/features.csv).
