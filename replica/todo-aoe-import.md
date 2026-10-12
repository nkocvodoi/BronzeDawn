# Việc còn lại cần máy có cài Age of Empires

Những việc dưới đây cần file gốc của game (`graphics.drs`, `empires.dat`...), máy Mac ở công ty không có.
Làm trên PC ở nhà, nơi có cài AoE + Rise of Rome. Khi xong một mục thì xoá mục đó khỏi file này.

## Trước khi bắt đầu

1. Pull `main` của BronzeDawn. Cần #75 đã merge (trình nhập lấy hoạt ảnh làm việc của mọi nghề) và nên có
   #74 (bản đồ từ `randomMaps`).
2. Clone hoặc pull repo private `BronzeDawn-aoe-data`. Máy Mac có 2 commit chưa push (công trình
   `anchorAt: center`, và `maps` trong manifest); push chúng từ máy Mac trước, hoặc chấp nhận là lần
   nhập lại sẽ ghi đè manifest (nhập lại cũng tạo ra cả hai thứ đó).
3. Nhập lại vào `web/assets-local`:
   `npm run import-aoe -- --aoe "C:/đường/dẫn/tới/AOE"` (thư mục cài, hoặc file `Empires.exe`).

## 1. Hoạt ảnh làm việc của người dân (đã sửa trình nhập ở #75, chỉ cần nhập lại)

- Hái quả, đào vàng/đá, cày ruộng, xây/sửa, đánh cá phải có `work` trong `villager:basket`, `pick`,
  `hoe`, `hammer`, `net` của manifest (lấy từ `proceedingGraphic`: "Man Forager", "Man Ore",
  "Man Farm", "Man Builder", "Man Fisher").
- Kiểm tra trong game: người dân cử động đúng nghề khi làm việc.

## 2. Hình công trình đang xây

- Người dùng báo: lúc đang xây, công trình không có hình các giai đoạn dựng lên.
- Dữ liệu công trình trong `empires.dat` có `constructionGraphic` (đã đọc trong `web/scripts/aoe/dat.ts`)
  nhưng `export-aoe.ts` chưa xuất.
- Cần: xuất hình đó cho từng công trình (theo kiến trúc nếu có), thêm một khoá trong manifest (ví dụ
  `construction`), và để `buildingPic` trong `web/src/game/art.ts` chọn khung theo tiến độ xây.
- Ghi khoá mới vào `replica/art-packs.md`.

## Sau khi nhập lại

- Đưa pack mới lên Art Packs (thư mục hoặc zip) để thử trên GitHub Pages, hoặc chạy `npm run dev`.
- Commit và push `BronzeDawn-aoe-data` (repo private). Không đưa file nào trong đó vào BronzeDawn hay bản
  deploy.
- Mỗi mục sửa code là một PR riêng từ `main`.
