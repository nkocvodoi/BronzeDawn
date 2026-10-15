# Self test: lỗi tìm được và cách tự kiểm

File này ghi mọi lỗi tìm được khi sàng lọc (chạy hàng loạt trận, chụp màn hình, bấm bừa, và báo lỗi từ trong
game), mỗi lỗi một mục: thấy ở đâu, vì sao, đã sửa chưa (PR nào), và **các bước tự kiểm bằng tay** để duyệt lại.
Mỗi đợt sàng lọc thêm vào cuối. Cột "Duyệt" để chủ repo đánh dấu khi đã tự kiểm.

## Công cụ

| Công cụ | Dùng thế nào | Bắt được gì |
| --- | --- | --- |
| **F8** (hoặc Menu → Report a bug) | Bấm khi thấy lỗi. Game tải về một file `.bdreport`: trận đang chơi (lưu nguyên), ảnh khung nhìn, 150 dòng thông báo và lỗi console gần nhất, cài đặt, cỡ màn hình | Gửi file này là đủ: mở bằng Saved Games → Load from a file là vào đúng trận đó, đúng lúc đó. Đọc không cần trình duyệt: `npm run report -- file.bdreport` (in tóm tắt, tách ảnh ra `.png`, chạy tiếp 2 phút xem có vỡ không) |
| `npm run soak -- [số trận] [phút] [phần] [số phần]` | Chạy từ `web/`. Ví dụ 8 tiến trình cùng lúc: `npm run soak -- 120 45 0 8` … `7 8` | Máy đấu máy trên mọi kiểu bản đồ, cỡ, 2–8 người, mọi dân tộc và mức AI; mỗi 10 giây game kiểm: không vỡ, unit không ra ngoài bản đồ hay đứng dưới nước, tài nguyên không âm, dân số không quá giới hạn (trừ quân cải đạo), hai công trình không chồng ô, dân không đứng không 3 phút khi còn tài nguyên, không kẹt thời đại 10 phút khi đủ điều kiện; lưu ở phút 8 rồi tải lại phải chạy y hệt; cùng seed hai lần phải ra cùng một trận. Mỗi lỗi ghi số trận, seed, phút: chạy lại được |

## Đợt 1 (2026-10-15)

Chạy hàng loạt: 120 trận × 45 phút (9 kiểu bản đồ, 72 đến 144 ô, 2–8 người, 21 dân tộc, 4 mức AI). Kết quả: **0** lần
vỡ, **0** lần lưu/tải chạy lệch, **0** lần cùng seed ra trận khác (chơi online không lệch), **0** unit ra ngoài bản đồ
hay đứng dưới nước, **0** công trình chồng nhau, **0** tài nguyên âm. Các mục dưới là những gì còn lại.

### 1. Thanh máu công trình treo trên đỉnh cột cờ (giao diện) — đã sửa

- **Thấy ở đâu:** ảnh trong báo lỗi F8 đầu tiên. Thanh máu Town Center đang chọn nằm cao trên mái, trên đầu cột cờ,
  lơ lửng trên ngôi nhà phía sau, nên trông như thanh máu của nhà kia.
- **Vì sao:** thanh máu công trình đặt trên điểm ảnh cao nhất của hình, tức ngọn cột cờ.
- **Sửa:** đặt trên đỉnh **thân** công trình (hàng điểm ảnh đầu tiên rộng ít nhất 1/7 hình), không tính cột cờ, chóp
  nhọn.
- **Tự kiểm:** vào trận, chọn Town Center, xây một nhà sát phía sau nó rồi chọn cả hai (Shift + bấm). Mỗi thanh máu
  phải nằm ngay trên mái công trình của nó, không lên trên cờ. Thử cả Barracks, Temple, tháp, và một công trình đang
  xây dở.
- **Duyệt:** [ ]

### 2. Dân làng trên đảo nhỏ đứng không, kẹt ở Bronze Age (AI) — đã sửa

- **Thấy ở đâu:** chạy hàng loạt, 4/120 trận, cả 4 trên Small Islands. Nặng nhất: trận #104 (seed 1104, Small
  Islands 120 ô, 4 người), Egyptian Hardest ở phút 33,7 có 22/26 dân đứng không, trong kho 1600 thức ăn, 3900 gỗ,
  9000 vàng, 1900 đá, mà vẫn ở Bronze Age.
- **Vì sao:** lên Iron Age cần 2 trong 4 công trình (Temple, Government Center, Siege Workshop, Academy). Đảo nhà
  đã kín ruộng và nhà trong 15 ô quanh Town Center, và hàm tìm chỗ xây chọn một chỗ **trên đảo bên cạnh** (cách 19
  ô qua biển), nơi không thợ nào đi bộ tới. Công trình không bao giờ lên, thời đại kẹt, dân không còn gì để làm.
- **Sửa:** trên bản đồ có biển, chỗ xây phải ở cùng vùng đất với nơi định xây gần đó (áp cho mọi công trình, ruộng
  và Storage Pit); hết chỗ trong 15 ô thì tìm xa dần tới 30 ô. Trận #104: phút 34 đã có Temple và Government Center,
  đang lên đời, 1 dân đứng không; phút 40 ở Iron Age.
- **Tự kiểm:** New game → Small Islands, cỡ Small, 3 máy Hardest, chế độ chỉ xem (Watch). Tua 5x tới phút 35–40,
  bấm V để xem từng máy: không máy nào có cả đám dân đứng không quanh Town Center trong khi kho đầy; các máy lên được
  Iron Age. Chạy máy: `npm run soak -- 120 45 0 8` (… `7 8`), không còn dòng `[stall]` trên Small Islands.
- **Duyệt:** [ ]

### 3. Dân số vượt giới hạn khi cải đạo (luật, cần chủ repo quyết) — để nguyên

- **Thấy ở đâu:** chạy hàng loạt, 6/120 trận: 51–54 người khi giới hạn là 50, ví dụ trận #11 (seed 1011), người chơi 5
  ở phút 15.
- **Vì sao:** đã đủ 50 người, thầy tu cải đạo thêm lính địch; cải đạo một thuyền chở quân thì được cả người trên thuyền (trận #40, seed 1040: 50 lên 54 bằng một lần cải đạo). Luyện quân vẫn chặn đúng ở giới hạn.
- **Quyết định:** theo bản gốc (AoE1 và AoE2), quân cải đạo được vượt giới hạn dân số, nên để nguyên; luật kiểm của
  chạy hàng loạt cho phép phần vượt bằng số quân đã cải đạo. Nếu muốn chặn (cải đạo không được khi đã đủ dân số), báo
  lại.
- **Tự kiểm:** có 50/50 dân số và một thầy tu, cải đạo một lính địch: dân số lên 51/50, và không luyện thêm được ai cho
  tới khi xuống dưới 50.
- **Duyệt:** [ ]

### 4. Mất Town Center thì không xây lại, dân đứng không mãi (AI) — đã sửa

- **Thấy ở đâu:** chạy hàng loạt lần 2, trận #12 (seed 1012, Mediterranean 144 ô, 8 người), Sumerian Hard ở phút
  31–41: 11 dân (5 đứng không), 1700 thức ăn, 178 gỗ, không Town Center; báo "đủ điều kiện lên Bronze Age 10 phút".
- **Vì sao:** Town Center giá 200 gỗ, máy có 178. Khi không có Town Center, máy bỏ hẳn việc chia việc cho dân: ai
  đứng không thì đứng không mãi, ai đang lấy thức ăn thì lấy tiếp, không ai đi chặt gỗ. Thêm nữa, "lên đời" không
  kiểm có Town Center không (game báo không bị chặn dù không có chỗ bấm).
- **Sửa:** thiếu gỗ cho Town Center thì mọi dân rảnh hoặc đang lấy thứ khác đi chặt gỗ (dựng Storage Pit cạnh rừng
  nếu chưa có chỗ cất); lên đời báo "Needs a Town Center" khi không có Town Center. Trận #12: phút 42 đã có Town
  Center mới, 20 dân, cả 18 đang làm.
- **Tự kiểm:** New game với 4 máy, chế độ chỉ xem, tua 10x tới khi có máy mất Town Center (bấm V để theo dõi máy
  đó): ít lâu sau dân của nó kéo đi chặt gỗ và một Town Center mới mọc lên. Với chính mình: xây thêm một nhà, xoá Town
  Center (Delete), chọn một dân: không còn nút lên đời; đủ 200 gỗ thì xây lại được Town Center.
- **Duyệt:** [ ]

### 5. Đảo nhà cạn sạch cuối trận: cả thị trấn đứng không (AI) — CHƯA SỬA, cần làm riêng

- **Thấy ở đâu:** chạy hàng loạt lần 2, Small Islands, phút 32–44: trận #59 (seed 1059) Palmyran Hardest 27/27 dân
  đứng không; trận #14 (seed 1014) Roman Hard 18/20, Dwarf 15/18; trận #104 Choson 8/8.
- **Vì sao:** đảo nhà chỉ còn mỏ đá; gỗ và thức ăn gần hết (ví dụ #59: 41 gỗ, 7 thức ăn, 5400 vàng). Đảo khác còn
  4000 gỗ, 19000 vàng, 18000 đá, nhưng máy chỉ biết chở dân sang **đốn gỗ**, và muốn sang phải có 120 gỗ cho Storage
  Pit bên đó; ruộng cũng cần gỗ. Thử cho dân sang đốn rồi mang gỗ về nhà khi kẹt: không đỡ (đã bỏ).
- **Cần làm:** máy biết đưa dân sang đảo khác đào vàng, đá và hái quả, săn, câu cá bằng thuyền khi đảo nhà cạn; giữ
  lại gỗ cho chuyến đầu từ sớm hơn. Việc lớn của AI trên đảo, nên làm thành một đợt riêng.
- **Tự kiểm (để thấy lỗi):** New game → Small Islands, cỡ Small, 3–4 máy Hardest, chế độ chỉ xem, tua 10x tới phút
  40, bấm V xem từng máy.
- **Duyệt:** [ ]

### Đã sửa trước đợt này

| Lỗi | PR | Tự kiểm |
| --- | --- | --- |
| Thanh máu dân làng nhảy lên theo dụng cụ (câu cá +32 px, đào mỏ +17, xây +13), 3/9 dân bị cao | #133 | Chọn 9 dân đang làm nhiều việc khác nhau: mọi thanh máu cùng độ cao trên đầu, đứng yên khi họ vung dụng cụ |
| AI trên đảo lớn cạn gỗ, kẹt Tool Age, chỉ luyện Clubman | #127 | Large Islands, cỡ Large, 8 người: tới phút 35–45 các máy còn người chặt gỗ ở đảo khác, có Archery Range |
