# Nhập lại hình AoE (trên máy có cài game)

Việc này cần file gốc của game (`empires.dat`, các file `.drs`, `language.dll`), nên chỉ làm được trên PC ở nhà,
nơi có cài AoE + Rise of Rome. Cần nhập lại khi trình nhập (`web/scripts/aoe/`) có thay đổi, ví dụ thêm khoá
manifest mới. Cách lệnh hoạt động và các thứ nó ghi ra: xem mục "Chơi bằng hình, tiếng và số liệu của bản AoE
bạn sở hữu" trong [README](../README.md).

## Các bước

1. Pull `main` của BronzeDawn.
2. Pull repo private `BronzeDawn-aoe-data` trong `web/assets-local`. Nếu máy khác (máy Mac) có commit chưa
   push trong đó thì push trước: lần nhập lại ghi đè `manifest.json`.
3. Nhập lại, chỉ vào thư mục cài game (thư mục có `Empires.exe`, `data` và `data2`; có `data2` thì trình nhập
   lấy cả Rise of Rome). Không biết game cài ở đâu thì xem `InstallationDirectory` trong registry, khoá
   `HKLM\SOFTWARE\WOW6432Node\Microsoft\Games\Age of Empires\1.00`.

   ```bash
   cd web
   npm run import-aoe -- --aoe "C:/đường/dẫn/tới/AOE"
   ```

   Lệnh in ra số thứ đã nhập, ví dụ `art: 58 unit sheets, 22 buildings, 19 construction sites, 16 cliff joins, ...`.

4. Xem trong game bằng `npm run dev` (khởi động lại dev server sau khi nhập).
5. Commit và push `BronzeDawn-aoe-data`.

## Đưa sang máy khác

- **Có git (máy Mac công ty):** pull `BronzeDawn-aoe-data` vào `web/assets-local`, rồi `npm run dev`.
- **Chỉ có trình duyệt (GitHub Pages):** nén `web/assets-local` thành zip (bỏ `.git`, `manifest.json` ở gốc
  zip) rồi nạp ở màn Art Packs. Art Packs chỉ thay hình, tiếng và bản đồ; số liệu gốc (`rules.json`) chỉ dùng
  được với `npm run dev`. Bản zip để tải nằm ở các release của `BronzeDawn-aoe-data`, mỗi lần nhập lại một
  release mới, gắn với commit của lần nhập đó.

## Không làm

- Không đưa file nào trong `web/assets-local` vào repo BronzeDawn (repo public), vào `web/public/` hay vào
  bản deploy, kể cả để thử. Đó là hình, tiếng và số liệu có bản quyền của bản gốc.
- Không chuyển `BronzeDawn-aoe-data` sang public: các release và file zip trong đó cũng public theo.
- Sửa trình nhập là sửa code: mỗi việc một PR riêng từ `main`, như mọi thay đổi khác.
