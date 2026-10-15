# Self test: lỗi tìm được và cách tự kiểm

File này ghi mọi lỗi tìm được khi sàng lọc (chạy hàng loạt trận, chụp màn hình, bấm bừa, và báo lỗi từ trong
game), mỗi lỗi một mục: thấy ở đâu, vì sao, đã sửa chưa (PR nào), và **các bước tự kiểm bằng tay** để duyệt lại.
Mỗi đợt sàng lọc thêm vào cuối. Cột "Duyệt" để chủ repo đánh dấu khi đã tự kiểm.

## Công cụ

| Công cụ | Dùng thế nào | Bắt được gì |
| --- | --- | --- |
| **F8** (hoặc Menu → Report a bug) | Bấm khi thấy lỗi. Game tải về một file `.bdreport`: trận đang chơi (lưu nguyên), ảnh khung nhìn, 150 dòng thông báo và lỗi console gần nhất, cài đặt, cỡ màn hình | Gửi file này là đủ: mở bằng Saved Games → Load from a file là vào đúng trận đó, đúng lúc đó. Đọc không cần trình duyệt: `npm run report -- file.bdreport` (in tóm tắt, tách ảnh ra `.png`, chạy tiếp 2 phút xem có vỡ không) |
| `npm run build && npm run ui-shots` | Chạy từ `web/`. Mở `web/ui-shots/index.html` để lướt ảnh | Mọi màn hình (menu chính, cài đặt trận, chơi online, art pack, lưu/tải, 5 trang Help, trong trận: Town Center, dân, chọn nhiều, Menu, Settings, Timeline, Diplomacy, Tribute, Help, lưu/tải, Resign, màn thua) ở 5 cỡ: điện thoại dọc 390×844 và ngang 844×390, laptop 1366×768, 1920×1080, 4K. Tự kiểm: trang cuộn ngang, bảng lòi ra ngoài màn hình, chữ bị cắt, nút đè nhau (chỉ phần nhìn thấy), nút ngoài màn hình, lỗi console. Những gì cần mắt người (chữ quá nhỏ, cân đối) thì xem ảnh |
| `npm run build && npm run monkey -- [số trận] [giây mỗi trận]` | Chạy từ `web/`. Kết quả ở `web/monkey-out/` (`findings.json` và ảnh). `MONKEY_SELFTEST=1` cài sẵn một lỗi để xem công cụ còn bắt được | Chơi bừa trên Chrome thật: bấm trái/phải, kéo chọn, Shift+bấm, phím chữ, số, Ctrl+số, Esc, F1, F3, F10, Tab, Space, Delete, +/−, nút lệnh, mở bảng và bấm nút ngẫu nhiên trong đó (trừ thoát, đầu hàng, xoá), lưu trận. Bắt: lỗi trang hay console, bảng bấm Esc 3 lần không đóng, màn hình đứng quá 1 giây, đồng hồ game dừng khi không tạm dừng. Mỗi lỗi kèm ảnh và 30 thao tác trước đó |
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

### 5. Đảo nhà cạn sạch cuối trận: cả thị trấn đứng không (AI) — đã sửa (đợt 4)

- **Thấy ở đâu:** chạy hàng loạt lần 2, Small Islands, phút 32–44: trận #59 (seed 1059) Palmyran Hardest 27/27 dân
  đứng không; trận #14 (seed 1014) Roman Hard 18/20, Dwarf 15/18; trận #104 Choson 8/8.
- **Vì sao (bốn chỗ):**
  1. Không đủ 120 gỗ cho Storage Pit bên kia thì máy không chở ai sang, mà gỗ thì chỉ bên kia mới có (#59: 41 gỗ,
     5400 vàng, cả 27 dân đứng không).
  2. **Lên thuyền là mất hết đồ đang mang** (luật cũ của game: `carry = 0` khi lên thuyền). Dân chặt gỗ bên kia rồi
     chở về, tới nơi tay không.
  3. Về tới nhà, dân bị giao việc khác ngay khi tay còn cầm gỗ, nên gỗ rơi mất (mỗi dân chỉ mang một loại).
  4. Máy không cho đào đá khi kho đã trên 200, nên dân đứng không ngay cạnh 1800 đá (#122: 22/22). Và mỗi lúc chỉ có
     một chuyến thuyền 3–5 người, dù 3 thuyền khác nằm không (#122: 17 dân chờ ở nhà).
- **Sửa:**
  1. Khi thị trấn đã đứng không, dân vẫn sang dù thiếu gỗ: chặt đầy tay, được đón về, cất vào Town Center; vài
     chuyến là đủ tiền Storage Pit.
  2. Đồ đang mang **đi theo dân lên thuyền** và còn nguyên khi lên bờ, như bản gốc. Đây là đổi luật, áp dụng cả cho
     người chơi.
  3. Về tới nhà, dân cất đồ vào Town Center trước rồi mới nhận việc.
  4. Hết việc "cần" thì lấy thứ còn lại (đá), không đứng không. Khi thị trấn đứng không, chạy tới 3 chuyến thuyền
     cùng lúc.
- **Đo:** soak 216 trận, 45 phút mỗi trận. Trên 48 trận đảo (Large + Small Islands): main kẹt 12 lần, bản sửa 1–3
  còn 10, bản cuối còn 5. Bản đồ đất liền (168 trận): 0 kẹt cả trước và sau. Không crash, không lỗi khác. Năm lần
  còn lại đều là thị trấn tàn (6–9 dân, phút 34–42), trong đó:
  - #104: thị trấn đang bị đánh sập, 14 lính địch trong làng, mất Town Center.
  - #167: cả bản đồ cạn thật, còn 160 gỗ; thức ăn nằm sát Town Center địch.
- **Chủ repo đã chốt (2026-10-15):** giữ luật mới, đồ dân đang mang đi theo dân lên thuyền.
- **Tự kiểm:** New game → Small Islands, cỡ Small, 3–4 máy Hardest, chế độ chỉ xem, tua 10x tới phút 30–40, bấm V
  xem từng máy: khi đảo nhà hết gỗ, thuyền chở dân qua lại, có Storage Pit mọc bên đảo khác. Với chính mình: cho một
  dân chặt gỗ (thấy bó gỗ trên tay), cho lên thuyền rồi thả xuống bờ khác: vẫn còn bó gỗ, mang tới Storage Pit thì
  được cộng.
- **Duyệt:** [ ]

## Đợt 2: chụp mọi màn hình ở 5 cỡ (2026-10-15)

110 ảnh (22 màn hình × 5 cỡ). Lần đầu 25 ảnh báo lỗi; sau khi sửa: 0. Thêm một lỗi chỉ mắt người thấy (mục 8).

### 6. Trên điện thoại, nút Menu nằm ngoài màn hình (giao diện) — đã sửa

- **Thấy ở đâu:** điện thoại dọc 390×844, mọi màn: thanh trên cùng rộng hơn màn hình, nút Menu ở ngoài mép phải,
  không bấm được; thanh dưới, minimap đè lên nút lệnh.
- **Vì sao:** giao diện co theo khung 800×600 nhưng không nhỏ hơn 0,75 lần, tức cần ít nhất 600 px ngang.
- **Sửa:** cho co tới 0,45 lần (vừa màn 390 px); điện thoại cầm dọc khi đang chơi có dòng "Turn your phone sideways
  to play" (chơi ngang thì dễ nhìn hơn nhiều).
- **Tự kiểm:** mở game trên điện thoại (hoặc Chrome → Inspect → thiết bị iPhone 12): thanh trên cùng nằm gọn, nút Menu
  bấm được; cầm dọc thấy dòng nhắc xoay ngang; xoay ngang chơi được.
- **Duyệt:** [ ]

### 7. Trên điện thoại, khung menu chính lẹm mép phải (giao diện) — đã sửa

- **Thấy ở đâu:** 390×844, màn hình đầu: khung rộng 394 px, lòi ra 17 px.
- **Vì sao:** khung có độ rộng tối thiểu 420 px.
- **Sửa:** tối thiểu 420 px hoặc bằng màn hình trừ 32 px, lấy số nhỏ hơn.
- **Tự kiểm:** màn hình đầu trên điện thoại: khung vừa màn, hai bên có lề.
- **Duyệt:** [ ]

### 8. Trên màn 4K, mọi bảng (Menu, Settings, Help...) bé xíu (giao diện) — đã sửa

- **Thấy ở đâu:** xem ảnh 3840×2160: bảng Settings chỉ cao 1/6 màn hình, chữ khó đọc, trong khi thanh trên và dưới đã to
  theo màn hình. Tự kiểm tự động không bắt được (không có gì tràn hay đè), chỉ thấy khi nhìn.
- **Vì sao:** các bảng có cỡ cố định tính bằng px; chỉ hai thanh quanh bản đồ co giãn.
- **Sửa:** bảng phóng to theo màn hình, 1 lần ở 1280×800 đến 2,2 lần ở 4K (giới hạn cao và rộng tính lại theo đó, để
  vẫn vừa màn hình). Timeline đọc chuột theo đúng tỉ lệ đó (thử ở 1280×800 và 4K: trỏ 10%, 50%, 90% đều ra 0:59,
  5:00, 9:00).
- **Tự kiểm:** trên màn lớn (hoặc Chrome → Inspect → kéo cửa sổ 3840×2160), mở Menu, Settings, Help, Timeline: bảng
  to vừa phải, chữ đọc được; trong Timeline, rê chuột thì số đọc đúng chỗ con trỏ.
- **Duyệt:** [ ]

## Đợt 3: chơi bừa trên trình duyệt (2026-10-15)

8 trận × 150 giây, khoảng 5200 thao tác ngẫu nhiên, 8 dân tộc khác nhau (có Beastfolk, Centaur) trên 7 kiểu bản đồ:
**không lỗi nào** (không lỗi trang hay console, không bảng kẹt, không đứng hình, đồng hồ không dừng). Kiểm lại công cụ
bằng một lỗi cài sẵn: bắt được ngay, kèm ảnh và các thao tác trước đó.

### Đã sửa trước đợt này

| Lỗi | PR | Tự kiểm |
| --- | --- | --- |
| Thanh máu dân làng nhảy lên theo dụng cụ (câu cá +32 px, đào mỏ +17, xây +13), 3/9 dân bị cao | #133 | Chọn 9 dân đang làm nhiều việc khác nhau: mọi thanh máu cùng độ cao trên đầu, đứng yên khi họ vung dụng cụ |
| AI trên đảo lớn cạn gỗ, kẹt Tool Age, chỉ luyện Clubman | #127 | Large Islands, cỡ Large, 8 người: tới phút 35–45 các máy còn người chặt gỗ ở đảo khác, có Archery Range |
