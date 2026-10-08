# Bronze Dawn so với Đế chế 1 (1997): những chỗ còn khác

Viết sau một lượt chơi bản web local (seed 7: đầu trận, phút 15 ở Tool Age, chọn dân làng, Town Center,
Barracks, một nhóm lính). Ngày 2026-10-08.

So sánh dựa trên trí nhớ về bản gốc, chưa đặt cạnh ảnh chụp thật. Những dòng ghi **(cần đối chiếu)** là
chỗ chưa chắc chắn, nên xác nhận bằng ảnh chụp AoE trước khi sửa.

Ranh giới không đổi: chỉ làm lại bố cục, tỉ lệ, cách hoạt động và phong cách. Hình, chữ, âm thanh vẫn tự làm.

## Vì sao trông "xấu" hơn bản 1997

Theo thứ tự ảnh hưởng tới cảm giác, nặng nhất trước.

### 1. Phong cách hình vẽ khác hẳn
- **Bản gốc** dùng sprite dựng sẵn từ mô hình 3D: có khối, đổ bóng mềm, nhiều chi tiết nhỏ, bảng 256 màu
  nhưng chuyển màu mượt. Một dân làng cao khoảng 40–50 điểm ảnh ở 800×600.
- **Bronze Dawn** dùng pixel art vẽ bằng code ở nửa độ phân giải rồi phóng to 2 lần (`ZOOMS` trong
  `game.ts`: mỗi điểm ảnh của hình chiếm 2×2 điểm ảnh màn hình). Kết quả là nét to, khối phẳng, giống game
  8-bit hơn là AoE. Đây là lý do lớn nhất khiến nó trông "rẻ".
- Hướng sửa: vẽ lại ở độ phân giải gốc (1 điểm ảnh hình = 1 điểm ảnh màn hình ở zoom mặc định), thêm
  đổ bóng theo khối (sáng trên trái, tối dưới phải), viền tối mảnh thay cho viền đen dày. Khối lượng lớn
  nhưng hiệu quả nhất. Có thể làm theo lô: dân làng → Town Center và nhà → cây, mỏ → lính.

### 2. Bảng điều khiển không co giãn theo màn hình
- **Bản gốc** chạy ở độ phân giải cố định (640×480, 800×600, 1024×768): thanh trên cùng khoảng 3–4% chiều
  cao, bảng dưới khoảng 20–25%. Nút lệnh to, chân dung to, chữ dễ đọc.
- **Bronze Dawn**: thanh trên 30 px, bảng dưới khoảng 130 px cố định. Trên cửa sổ 1345×1282 lúc thử,
  bảng dưới chỉ chiếm 10% chiều cao. Nút lệnh 48 px nằm lọt thỏm giữa một dải gỗ trống rất dài.
- Hướng sửa: thiết kế HUD theo khung 800×600 rồi phóng theo tỉ lệ cửa sổ (một biến `--ui-scale`), để tỉ
  lệ giống bản gốc ở mọi màn hình. Việc nhỏ, thấy ngay.

### 3. Bố cục bảng dưới
- **Bản gốc**: ô thông tin bên trái (chân dung lớn, tên, máu, các chỉ số kèm biểu tượng), lưới nút lệnh ở
  giữa chiếm gần hết bề ngang (2 hàng, các nút lớn sát nhau), minimap hình thoi bên phải trong khung đá.
- **Bronze Dawn**: các nút dồn vào giữa, hai bên trống. Khi chọn Town Center chỉ có 2 nút nhỏ trên cả dải.
  Nhiều unit cùng lúc thì chân dung chỉ 28 px.
- Hướng sửa: lưới nút cố định 2 hàng × 6–7 ô chiếm toàn bộ phần giữa, ô trống vẫn vẽ khung (như bản gốc),
  chân dung chọn nhiều to gấp đôi.

### 4. Chất liệu khung giao diện
- **Bản gốc**: khung đá chạm khắc, viền nổi, màu theo nhóm văn minh **(cần đối chiếu: có đổi theo dân
  tộc hay không)**.
- **Bronze Dawn**: gỗ ván lặp lại, đinh tán, nhìn phẳng.
- Hướng sửa: texture đá có vân, viền vát sáng/tối, góc chạm; nếu bản gốc đổi theo văn minh thì làm 4 bộ
  màu theo 5 kiểu kiến trúc đã có.

### 5. Mặt đất và sương mù
- **Bản gốc**: cỏ có vân, có mảng đất, cát, nền rừng; rừng mọc thành mảng dày. Sương mù có viền răng cưa
  theo ô, vùng đã khám phá phủ tối kiểu lưới chấm.
- **Bronze Dawn**: cỏ gần như một màu, cây mọc rải rác, viền sương mờ nhòe như ảnh bị blur.
- Hướng sửa: thêm biến thể ô cỏ và mảng đất; sinh rừng thành cụm dày; vẽ sương theo ô thay vì phóng to một
  ảnh nhỏ có làm mờ.

### 6. Chọn unit
- **Bản gốc** **(cần đối chiếu)**: khung chữ nhật mảnh quanh unit được chọn, thanh máu phía trên.
- **Bronze Dawn**: vòng elip dưới chân, giống AoE2 hơn.

### 7. Màn hình ngoài trận
- **Bản gốc**: menu chính toàn màn hình (Single Player, Multiplayer, Help, Scenario Builder, Exit), rồi màn
  hình thiết lập trận có danh sách người chơi (văn minh, màu, đội), kiểu bản đồ, cỡ, độ khó, tài nguyên
  khởi đầu, mở bản đồ, điều kiện thắng. Hết trận có bảng thống kê nhiều tab.
- **Bronze Dawn**: một hộp thoại nhỏ giữa màn hình, kết thúc trận chỉ có 3 dòng chữ.

## Khác về lối chơi và điều khiển

Đã ghi trong `roadmap.md` (mục "Chỗ đang khác bản gốc"), nhắc lại cho đủ: farm đi xuyên qua được, có rally
point và attack-move, có tốc độ 3x, AI Khó thu nhanh hơn thay vì được thêm tài nguyên.

Thấy thêm khi chơi:
- Dòng chào "Your civilization… Good luck" còn nằm trên màn hình ở phút 15 khi xem bằng `?snapshot`. Lỗi
  nhỏ: lúc tua nhanh không xoá tin nhắn cũ.
- Tin nhắn hiện giữa phía trên. Bản gốc hiện tin nhắn và chat ở góc trên bên trái **(cần đối chiếu)**.
- Phím `.` chọn dân làng rảnh là tiện ích của AoE2, bản gốc không có **(cần đối chiếu)**.
- Chưa có điểm số trên màn hình (bản gốc có bảng điểm các người chơi, bật tắt bằng phím).
- Chưa có tàu, đồi, kiểu bản đồ có biển, ruins/artifact, nhiều người chơi: đã có trong roadmap.

## Đối chiếu bằng ảnh chụp bản gốc (800×600, 5 ảnh, 2026-10-08)

Đã xác nhận:
- Thanh trên cao khoảng 18 px: tài nguyên bên trái (gỗ, thức ăn, vàng, đá), tên thời đại ở giữa, bên phải
  chỉ có Diplomacy và Menu. Không có dân số, không có đồng hồ.
- Bảng dưới cao khoảng 126 px (21%). Ô thông tin đen rộng khoảng 133 px: văn minh và tên ở góc trên, chân
  dung, chỉ số kèm biểu tượng, thanh máu và số máu ở dưới.
- Lưới nút 6 cột × 2 hàng, nút khoảng 50×52 px, bắt đầu ngay sau ô thông tin, không ghi phím tắt. Mỗi loại
  lệnh có chỗ cố định: Town Center để Villager ở hàng trên, nút lên đời ở hàng dưới cùng cột. Nút X đỏ ở
  hàng dưới, cột 6.
- Chọn nhiều unit: ô thông tin chỉ hiện unit đầu tiên.
- Khung giao diện đổi theo văn minh (Ai Cập: phù điêu sa thạch).
- Unit được chọn có hình thoi trắng mảnh dưới đất và thanh máu phía trên (không phải khung chữ nhật).
- Dòng gợi ý khi rê chuột ("Click to select this building.") ở góc dưới bên trái vùng bản đồ.
- Tên dân làng đổi theo việc: Builder, Woodcutter…
- Menu xây ở Stone Age chỉ hiện những gì xây được: House, Barracks, Granary, Storage Pit, Dock.
- Sương mù: vùng đã khám phá phủ lưới chấm tối, mép vùng nhìn thấy lượn theo ô.

## Đã làm (bước 1, nhánh `aoe-feel`)

- HUD theo khung 800×600, phóng theo cửa sổ bằng `--u`; zoom bản đồ lúc vào trận cũng theo tỉ lệ đó.
- Thanh trên chỉ còn tài nguyên, dân số, thời đại, Diplomacy, Menu. Tốc độ, âm thanh, nhạc, khóa chuột,
  toàn màn hình chuyển vào Menu (F10). Diplomacy liệt kê người chơi, văn minh và bonus.
- Bảng dưới theo đúng vị trí đo được; nút X ở hàng dưới cột 6; Town Center và nhà nghiên cứu xếp nút theo hàng.
- Khung đá chạm khắc tự vẽ theo 5 kiểu kiến trúc (`reliefTexture` trong `art.ts`).
- Hình thoi khi chọn; chọn nhiều hiện unit đầu tiên; tên dân làng theo việc; dòng gợi ý góc dưới trái;
  tin nhắn góc trên trái; nút S và F4 hiện điểm (cách tính điểm tự đặt, chưa theo bản gốc).

Còn khác có chủ ý: dân số vẫn hiện trên thanh trên (bản gốc không có) vì không có nó rất khó chơi.

## Đề xuất thứ tự làm

1. HUD co giãn theo cửa sổ và lưới nút lệnh kiểu bản gốc (mục 2, 3). Một đến hai buổi, thấy khác ngay.
2. Khung đá cho giao diện (mục 4) và menu chính / màn hình thiết lập trận (mục 7).
3. Mặt đất, rừng, sương mù (mục 5).
4. Vẽ lại sprite ở độ phân giải gốc có đổ bóng (mục 1). Việc lớn nhất, làm theo lô.

Trước bước 1 nên có 3 ảnh chụp AoE thật: đang chọn dân làng, đang mở menu xây, đang chọn Town Center, để
đo đúng tỉ lệ và vị trí.
