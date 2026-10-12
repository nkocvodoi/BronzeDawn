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

## 3. Núi / vách đá (cliffs)

- Người dùng báo: art pack không có hình núi/vách đá.
- `graphics` trong dữ liệu có "Cliffs", "Cliffs 1"..."Cliffs 10", "CliffsB 1"..."CliffsB 7"; đơn vị
  số 34 là "Cliff".
- Cần: tìm hình nào ứng với hướng/đoạn vách nào, xuất ra, thêm khoá manifest, và để `cliffPic` trong
  `art.ts` dùng hình của pack khi có.

## Sau khi nhập lại

- Đưa pack mới lên Art Packs (thư mục hoặc zip) để thử trên GitHub Pages, hoặc chạy `npm run dev`.
- Commit và push `BronzeDawn-aoe-data` (repo private). Không đưa file nào trong đó vào BronzeDawn hay bản
  deploy.
- Mỗi mục sửa code là một PR riêng từ `main`.
