# Lộ trình Bronze Dawn (bản web)

Mục tiêu: **lối chơi giống Đế chế 1 (1997) + The Rise of Rome càng sát càng tốt, chạy trên trình duyệt.**
Hình, âm thanh, nhạc và tên gọi đều tự làm mới, không chép của bản gốc (xem mục "Ranh giới" ở dưới).

Cách đo: `replica/features.csv` liệt kê từng tính năng của bản gốc, chấm bằng
`python3 ../replica-skill/replica-diff/parity.py replica/features.csv`. Số liệu của bản gốc lấy từ
`replica/game/aoe1-research.md` (có nguồn cho từng con số).

**Hiện tại: 92.9 / 100** (đủ 21/21 tính năng bắt buộc).
Cập nhật lần cuối: 2026-10-09, sau khi có đồi, vách đá và nước nông (Giai đoạn 4, phần 3).

Đây là bảng chấm chi tiết. Bảng thô trước đó cho 95.5 vì gộp nhiều thứ vào một dòng (cả phần tàu thuyền,
địa hình, âm thanh đều chưa có dòng nào). Mỗi khi xong một hạng mục, sửa cột `clone` trong `features.csv`
rồi chấm lại.

## Đã làm

| Nhóm | Đã có |
| --- | --- |
| Bản đồ | Isometric, sinh ngẫu nhiên theo seed, 4 cỡ (72 / 96 / 120 / 144), hồ, rừng, sương mù, vị trí xuất phát ngẫu nhiên theo seed |
| Kinh tế | 4 tài nguyên, hái dâu, săn thú (thịt thối dần, chỉ villager giết mới có thịt), đánh cá ven bờ, farm sau Market, kho thịt và kho lúa riêng |
| Thời đại | Stone, Tool, Bronze, Iron, mỗi lần lên cần 2 loại công trình của thời đó |
| Nội dung | 33 unit với các dòng nâng cấp, 21 công trình, 65 công nghệ, 17 dân tộc (5 kiểu kiến trúc; Lạc Việt của Return of Rome có khung giao diện trống đồng riêng) |
| Chiến đấu | Công thức sát thương gốc, giáp xuyên, công trình nhận 1/5 sát thương, đá văng và né được, voi giẫm, tháp canh 4 cấp, tường kéo dài |
| Tôn giáo | Thầy tu cải đạo và chữa thương, faith hồi dần, Monotheism |
| Thắng | Chinh phục, Wonder (đứng 15 phút) |
| AI | 3 mức, chơi đủ 4 thời đại, săn, nghiên cứu, tập hợp quân trước khi đánh; mức Khó thu nhanh hơn 20% (ghi rõ trên màn hình); chế độ chỉ xem các máy đánh nhau (V đổi góc nhìn, tới 10x) |
| Giao diện | Bố cục kiểu bản gốc, phím xây B + chữ, phím luyện quân của bản gốc, đối tượng nháy khi giao việc, tốc độ 1x đến 3x, hiển thị dân tộc, tùy chọn ruộng tự trồng lại (kiểu AoE2, bật sẵn, tắt trong Menu), thời gian còn lại khi luyện quân, nghiên cứu, lên đời và xây (thanh trên cùng đếm ngược lúc lên đời) |
| Hình | Pixel art vẽ bằng code cho mọi unit, thú, công trình (4 thời đại, 4 giai đoạn xây), tường nối liền |
| Kiểm thử | 34 unit test, smoke test bằng chuột và phím thật trên Chrome, trận AI đấu AI chạy không cần màn hình, CI và deploy lên GitHub Pages |

## Còn thiếu, theo thứ tự nên làm

Thứ tự dựa trên mức ảnh hưởng tới cảm giác "đang chơi Đế chế" và khối lượng việc.

### Giai đoạn 1: cảm giác điều khiển (nhỏ, thấy ngay)
- [x] Con trỏ đổi theo ngữ cảnh: kiếm khi trỏ vào địch, rìu / cuốc / giỏ khi trỏ vào tài nguyên, búa khi trỏ vào nền móng, gậy cho thầy tu (`web/src/game/cursors.ts`, pixel art tự vẽ)
- [x] Sửa công trình (villager, tốn tài nguyên; nút Repair phím R hoặc chuột phải), công trình hư thì bốc cháy, phá xong để lại gạch vụn; AI cũng biết sửa
- [x] Tư thế Stand ground (phím D), lệnh Attack ground cho máy bắn đá (phím T; Heavy Catapult phá được cây)
- [x] Shift + chuột phải để đặt điểm đi qua (tối đa 20 điểm)
- [x] Tab để chuyển giữa các unit đang chọn
- [x] Space để về chỗ đang chọn; Shift + số để gộp nhóm; giới hạn chọn 25 unit
- [x] Thứ tự tài nguyên trên thanh trên cùng như bản gốc (gỗ, thức ăn, vàng, đá)

### Giai đoạn 2: âm thanh (đã có bản đầu, `web/src/game/sound.ts`)
- [x] Hiệu ứng âm thanh: chặt gỗ, đào mỏ, hái lượm, làm ruộng, đánh cá, xây; kiếm, chùy, cung, đá văng; nhà sập, xây xong, luyện xong, nghiên cứu xong, lên đời, báo bị tấn công
- [x] Tiếng đáp lời của unit khi chọn và khi ra lệnh (một thứ tiếng bịa, tổng hợp bằng formant), tiếng tụng của thầy tu khi cải đạo, mỗi công trình có tiếng riêng khi chọn
- [x] Nhạc nền tự sinh: drone, đàn lyre, trống tay, sáo, điệu D dorian; nút Sound / Music trên thanh trên cùng
- Toàn bộ tổng hợp bằng Web Audio lúc chạy, không có file âm thanh nào. Không lấy âm thanh của bản gốc.
- [ ] Tinh chỉnh: nghe thử thật và cân lại âm lượng từng tiếng; thêm tiếng thú (voi, sư tử), tiếng ngựa

### Giai đoạn 3: nước và tàu (lớn)
- [x] Dock (cũng là công trình tính để lên Tool Age), đặt dưới nước sát bờ
- [x] Thuyền đánh cá (nâng cấp Fishing Ship) và cá ngoài khơi; AI tự xây Dock và đánh cá
- [x] Thuyền buôn (Trade Boat, Merchant Ship) và buôn bán giữa các dock
- [x] Tàu chiến: scout ship, war galley, trireme, catapult trireme, juggernaught, fire galley (bonus tàu của các dân tộc đã có tác dụng)
- [x] Thuyền chở quân (Light 5 chỗ, Heavy 10 chỗ; chìm thì quân chết theo)
- [x] Bản đồ có biển: coastal, continental, mediterranean
- [x] Bản đồ đảo (small islands, large islands); AI chưa biết dùng thuyền chở quân (phần 4)
- [x] AI biết dùng thuyền: Dock, thuyền đánh cá, hải quân nhỏ, chở quân sang đảo
- [ ] AI trên bản đồ đảo còn yếu: mỗi chuyến chỉ chở 5 lính nên hay bị tiêu diệt dần; cần gom nhiều chuyến, có tàu chiến hộ tống
- Mọi bonus tàu của các dân tộc đã có tác dụng, kể cả thuyền chở quân nhanh hơn 30% của Carthaginian.

### Giai đoạn 4: bản đồ và luật còn lại (vừa)
- [x] Đồi (cao 0 đến 3), vách đá, độ cao (đánh từ trên cao xuống có 25% cơ hội gây gấp 3 sát thương, như bản gốc), vùng nước nông lội qua được ở chỗ đường nối các căn cứ băng qua nước
- [ ] Các kiểu bản đồ: inland, highland, continental, hill country, narrows; cỡ Gigantic
- [x] Ruins và artifact (5 mỗi loại), chiếm bằng cách đến gần; artifact mang đi được, kể cả trên thuyền; giữ hết một loại 15 phút là thắng; 10 điểm mỗi cái và 50 khi giữ hết; AI biết đi chiếm và giành lại
- [x] Mỗi dân tộc thiếu đúng các unit và công nghệ như bản gốc (theo cây công nghệ bản DE, cả 17 dân tộc)
- [x] Martyrdom (nút Sacrifice, phím Q)
- [x] Điểm số kiểu bản gốc: quân sự, kinh tế, tôn giáo, công nghệ, khác (trên bản đồ nhỏ và cuối trận)
- [x] Thắng theo điểm (300 / 500 / 800) hoặc hết giờ (15 đến 90 phút); đội tính điểm trung bình như bản gốc; chế độ chỉ thắng bằng chinh phục
- [x] Tùy chọn khi bắt đầu: mở toàn bản đồ, thời đại khởi đầu, tài nguyên khởi đầu (Low đến Death Match), giới hạn dân số (25 đến 200)

### Giai đoạn 5: nhiều người chơi (lớn)
- [x] Tới 8 người chơi (1 đến 7 máy), máy đánh riêng hoặc liên minh chống bạn
- [ ] Chia đội tùy ý, đồng minh với máy, trạng thái ngoại giao, cống nạp
- [ ] 5 mức AI (Easiest đến Hardest)
- [ ] Lưu và tải trận
- [ ] Chơi online với bạn bè: lockstep qua WebRTC. Phần mô phỏng đã tất định sẵn cho việc này.

## Chỗ đang khác bản gốc (đã chọn, có thể đổi)

| Khác biệt | Bản gốc | Hiện tại | Ghi chú |
| --- | --- | --- | --- |
| Farm | Chặn đường đi | Mặc định đi xuyên qua được, như bản Definitive Edition | Tùy chọn "Farms block the way" ở màn hình bắt đầu để chơi đúng luật gốc |
| Rally point, attack-move | Không có | Có | Tiện lợi kiểu hiện đại; có thể làm thành tùy chọn |
| Tốc độ 3x | Tối đa 2x | Có thêm 3x | |
| AI mức Khó | Hardest được thêm tài nguyên | Thu nhanh hơn 20% | Cùng ý tưởng là AI được lợi thế, cách thực hiện khác |
| Lượng thức ăn mỗi lần mang, lượng vàng và đá mỗi mỏ | Chưa xác nhận được | 10 / 400 / 300 | Đánh dấu (?) trong bản nghiên cứu |

## Ranh giới (sẽ không làm)

- Không chép sprite, âm thanh, nhạc, chữ, giao diện hay tên "Age of Empires" của bản gốc. Game chạy công khai trên
  GitHub Pages, nên chép vào là phát tán tài sản có bản quyền. "Giống 100%" ở đây nghĩa là lối chơi và cảm giác,
  không phải tài sản.
- Campaign và trình chỉnh kịch bản: để sau cùng, có thể không làm.

## Ghi chú cho bản Mac

Bản Mac (`Sources/`, `data/rules-mac.json`) vẫn dừng ở bộ luật 2 thời đại cũ, chưa nhận các thay đổi của bản web.
