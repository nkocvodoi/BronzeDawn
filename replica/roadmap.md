# Lộ trình Bronze Dawn (bản web)

Mục tiêu: **lối chơi giống Đế chế 1 (1997) + The Rise of Rome càng sát càng tốt, chạy trên trình duyệt.**
Hình, âm thanh, nhạc và tên gọi đều tự làm mới, không chép của bản gốc (xem mục "Ranh giới" ở dưới).

Cách đo: `replica/features.csv` liệt kê từng tính năng của bản gốc, chấm bằng
`python3 ../replica-skill/replica-diff/parity.py replica/features.csv`. Số liệu của bản gốc lấy từ
`replica/game/aoe1-research.md` (có nguồn cho từng con số).

**Hiện tại: 94.2 / 100** (đủ 21/21 tính năng bắt buộc).
Cập nhật lần cuối: 2026-10-09, sau khi xong Giai đoạn 4 (thêm kiểu bản đồ Highland, Hill Country, Narrows và cỡ Gigantic).

Đây là bảng chấm chi tiết. Bảng thô trước đó cho 95.5 vì gộp nhiều thứ vào một dòng (cả phần tàu thuyền,
địa hình, âm thanh đều chưa có dòng nào). Mỗi khi xong một hạng mục, sửa cột `clone` trong `features.csv`
rồi chấm lại.

## Đã làm

| Nhóm | Đã có |
| --- | --- |
| Bản đồ | Isometric, sinh ngẫu nhiên theo seed, 4 cỡ (72 / 96 / 120 / 144), hồ, rừng, sương mù, vị trí xuất phát ngẫu nhiên theo seed |
| Kinh tế | 4 tài nguyên, hái dâu, săn thú (thịt thối dần, chỉ villager giết mới có thịt; hươu đi theo bầy 4 đến 7 con, sư tử săn hươu), đánh cá ven bờ, farm sau Market, kho thịt và kho lúa riêng |
| Thời đại | Stone, Tool, Bronze, Iron, mỗi lần lên cần 2 loại công trình của thời đó |
| Nội dung | 33 unit với các dòng nâng cấp, 21 công trình, 65 công nghệ, 17 dân tộc (5 kiểu kiến trúc; Lạc Việt của Return of Rome có khung giao diện trống đồng riêng); thêm 4 tộc giả tưởng (Elf, Dwarf, Centaur, Beastfolk) với 8 unit và 4 tech riêng, số trong `data/fantasy.json` (`replica/game/fantasy-races.md`) |
| Chiến đấu | Công thức sát thương gốc, giáp xuyên, công trình nhận 1/5 sát thương, đá văng và né được, voi giẫm, tháp canh 4 cấp, tường kéo dài |
| Tôn giáo | Thầy tu cải đạo và chữa thương, faith hồi dần, Monotheism |
| Thắng | Chinh phục, Wonder (đứng 15 phút) |
| AI | 5 mức, chơi đủ 4 thời đại, săn, nghiên cứu, tập hợp quân trước khi đánh; mức Khó thu nhanh hơn 15% (ghi rõ trên màn hình); từ mức Moderate chơi theo thế mạnh dân tộc (đọc từ bonus: nhà lính nào xây trước và xây thêm cái thứ hai, loại quân nào được ưu tiên, nâng cấp dòng quân mạnh sớm, thêm tàu nếu giỏi trên biển); chế độ chỉ xem các máy đánh nhau (V đổi góc nhìn, tới 10x) |
| Giao diện | Bố cục kiểu bản gốc, phím xây B + chữ, phím luyện quân của bản gốc, đối tượng nháy khi giao việc, tốc độ 1x đến 3x, hiển thị dân tộc, tùy chọn ruộng tự trồng lại (kiểu AoE2, bật sẵn, tắt trong Menu), thời gian còn lại khi luyện quân, nghiên cứu, lên đời và xây (thanh trên cùng đếm ngược lúc lên đời); trang Help chia tab (Getting started, Mouse, Keys, Build & train, Rules, Civilizations); tự đặt phím tắt và nút chuột giữa / nút phụ (tab Keys, lưu trong trình duyệt) |
| Hình | Mọi unit, thú, công trình (theo thời đại và kiến trúc), ô đất, cây, mỏ dựng bằng code trong `art3d/` rồi render bằng Blender; hình vẽ bằng code còn làm dự phòng; tường và vách đá nối liền |
| Gói hình (Art Packs) | Người chơi tự nạp hình, tiếng và bản đồ từ thư mục hoặc zip, lưu trong trình duyệt; `npm run import-aoe` lấy hình, tiếng, số liệu từ bản AoE của chính mình vào `web/assets-local/` (chỉ dev server dùng, không bao giờ vào repo hay bản deploy), kể cả công trường lúc đang xây và vách đá |
| Kiểm thử | 128 unit test, smoke test bằng chuột và phím thật trên Chrome (cả chơi online), so từng hình với dấu vân tay (`smoke:art`, 2.191 hình), trận AI đấu AI chạy không cần màn hình, CI và deploy lên GitHub Pages |

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
- Tinh chỉnh âm lượng và thêm tiếng thú, tiếng ngựa: không làm nữa, nghe thử thấy ổn (2026-10-12)

### Giai đoạn 3: nước và tàu (lớn)
- [x] Dock (cũng là công trình tính để lên Tool Age), đặt dưới nước sát bờ
- [x] Thuyền đánh cá (nâng cấp Fishing Ship) và cá ngoài khơi; AI tự xây Dock và đánh cá
- [x] Thuyền buôn (Trade Boat, Merchant Ship) và buôn bán giữa các dock
- [x] Tàu chiến: scout ship, war galley, trireme, catapult trireme, juggernaught, fire galley (bonus tàu của các dân tộc đã có tác dụng)
- [x] Thuyền chở quân (Light 5 chỗ, Heavy 10 chỗ; chìm thì quân chết theo)
- [x] Bản đồ có biển: coastal, continental, mediterranean
- [x] Bản đồ đảo (small islands, large islands); AI chưa biết dùng thuyền chở quân (phần 4)
- [x] AI biết dùng thuyền: Dock, thuyền đánh cá, hải quân nhỏ, chở quân sang đảo
- [x] AI trên bản đồ đảo: xây Dock trên bờ đảo mình (trước đây chọn nhầm bờ đảo khác nên không bao giờ có Dock), để dành gỗ cho thuyền chở quân, chở cả đợt (ít nhất 10 lính) qua nhiều chuyến, tập trung ở bãi đổ bộ rồi mới đánh, tàu chiến giữ bãi; đảo nhà rộng hơn và có khoảng 10.000 gỗ
- [x] AI trên bản đồ đảo, phần 2: chỉ giao dân làng tài nguyên đi bộ tới được (trước đây đi đào mỏ vàng ở đảo khác rồi đứng không); đón quân ở vùng nước thuyền tới được, cạnh đất của đảo nhà (trước đây có lúc chờ ở một hồ trong đảo); đổ bộ ở bờ biển mở; thuyền thả quân lên đúng vùng đất được chỉ (ở eo biển hẹp có lính lên nhầm đảo bên cạnh, lỗi này cũng có khi người chơi điều khiển); lính đánh phá chỉ nhắm thứ đi bộ tới được (không đứng mãi trước một Dock), hết mục tiêu thì được thuyền đón đi tiếp; thêm Storage Pit cạnh rừng ở xa
- [x] AI trên bản đồ đảo: 20 trận thử (Small và Large Islands, Khó đấu Dễ và Thường, 5 seed mỗi cặp) thì Khó thắng 17, thua 2 (cả hai ở cùng một bản đồ, Greek đấu Shang), 1 trận hết 90 phút; trước đó 13 thắng, 1 thua, 6 trận hết giờ vì không dứt điểm được bên thua (chỉ còn một Dock, hoặc vài lính trên đảo khác)
- [x] AI trên đảo nhỏ khai thác đảo khác: khi gỗ trên đảo nhà sắp hết, máy chở dân sang đảo phụ có rừng, dựng Storage Pit và đốn; hết rừng thì sang đảo tiếp theo hoặc về nhà. Đảo phụ của Small Islands giờ có rừng (2.000-4.000 gỗ mỗi đảo, trước gần như không có cây)
- [x] AI trên đảo, bản đồ lớn nhiều người (Large Islands, 8 người): gỗ đảo nhà cạn ở phút 30–35 và cả thị trấn kẹt (Elf đứng ở Tool Age với 2000 thức ăn, 1600 vàng, 28 gỗ, chỉ luyện được Clubman). Sửa: đặt Storage Pit ở đảo khác cả khi vừa cập bờ chưa nhìn thấy đất (trước đây bỏ cuộc ngay, mọi máy trên đảo đều bị), tìm chỗ rộng hơn, thuyền riêng cho việc chở dân đi đốn (không phải chờ thuyền chở quân), giữ gỗ từ khi đảo nhà còn dưới 3000, tạm không trồng lại ruộng khi đang để dành, tìm rừng gần địch hơn nếu không còn chỗ xa (12 ô). Elf lên Iron Age ở phút 45, có Archery Range, Improved Bowman, Glade Archer
- [x] Săn voi: một dân làng đi một mình bị voi giết; giờ máy gửi 5 người cùng lúc, chỉ voi cạnh Town Center hoặc Granary và khi có từ 10 dân trở lên (khoảng 11 trên 26 con voi ở 6 bản đồ Inland trong 15 phút đầu)
- [ ] AI trên đảo: vẫn còn khoảng 1/5 số trận Khó đấu Dễ/Thường hết 90 phút; các trận này kẹt ở khâu đánh nhau (đợt đổ bộ nhỏ, giới hạn dân số 50), không còn do cạn kinh tế
- Mọi bonus tàu của các dân tộc đã có tác dụng, kể cả thuyền chở quân nhanh hơn 30% của Carthaginian.

### Giai đoạn 4: bản đồ và luật còn lại (xong)
- [x] Đồi (cao 0 đến 3), vách đá, độ cao (đánh từ trên cao xuống có 25% cơ hội gây gấp 3 sát thương, như bản gốc), vùng nước nông lội qua được ở chỗ đường nối các căn cứ băng qua nước
- [x] Các kiểu bản đồ: highland, hill country, narrows (cùng inland, continental đã có); cỡ Gigantic 200 x 200
- [x] Bộ sinh bản đồ làm lại theo đúng Empiresx.exe (`web/src/core/aoemap.ts`, mô tả ở `replica/game/aoe1-mapgen.md`): đủ 9 kiểu bản đồ của Rise of Rome với số liệu lấy từ `empires.dat` (`data/aoe-maps.json`); đủ các bước lands, shallows, đồi (cố định trong exe), vách đá, mảng địa hình, bãi biển, objects; khoảng cách tính theo Chebyshev như bản gốc; cỡ bản đồ đúng bản gốc (Tiny 72, Small 96, Medium 120, Large 144, Huge 200, Gigantic 250). Cùng thuật toán và cùng số liệu, nhưng cùng một seed chưa ra đúng bản đồ của game gốc (xem §8 của tài liệu)
- [ ] Bản đồ giống từng ô với game gốc theo seed: còn thiếu hình các đoạn vách đá, các lần gọi rand khi đặt ô có unit tự sinh, và rand hướng quay của object
- [x] Ruins và artifact (5 mỗi loại), chiếm bằng cách đến gần; artifact mang đi được, kể cả trên thuyền; giữ hết một loại 15 phút là thắng; 10 điểm mỗi cái và 50 khi giữ hết; AI biết đi chiếm và giành lại
- [x] Mỗi dân tộc thiếu đúng các unit và công nghệ như bản gốc (theo cây công nghệ bản DE, cả 17 dân tộc)
- [x] Martyrdom (nút Sacrifice, phím Q)
- [x] Điểm số kiểu bản gốc: quân sự, kinh tế, tôn giáo, công nghệ, khác (trên bản đồ nhỏ và cuối trận)
- [x] Thắng theo điểm (300 / 500 / 800) hoặc hết giờ (15 đến 90 phút); đội tính điểm trung bình như bản gốc; chế độ chỉ thắng bằng chinh phục
- [x] Tùy chọn khi bắt đầu: mở toàn bản đồ, thời đại khởi đầu, tài nguyên khởi đầu (Low đến Death Match), giới hạn dân số (25 đến 200)

### Giai đoạn 5: nhiều người chơi (xong)
- [x] Tới 8 người chơi (1 đến 7 máy), máy đánh riêng hoặc liên minh chống bạn
- [x] Chia đội tùy ý (tới 4 đội), đồng minh với máy, trạng thái ngoại giao (đồng minh / trung lập / kẻ thù) trong màn hình Diplomacy, cống nạp 100 mỗi lần (phí 25%, miễn phí khi có Coinage hoặc là người Palmyran); máy trung lập được cống đủ 2600 sẽ thành đồng minh
- [x] 5 mức AI: Easiest (dừng ở Tool Age, tối đa 8 lính), Easy, Moderate, Hard (thu nhanh hơn 20%), Hardest (như Hard, thêm 2000 mỗi loại lúc đầu, như bản gốc ăn gian); AI không xuất quân khi ít hơn 80% quân địch
- [x] Lưu và tải trận: lưu toàn bộ trạng thái (cả AI) trong trình duyệt hoặc ra file .bdsave (nén gzip, khoảng 0,1 MB cho bản đồ nhỏ); trận tải lại chạy tiếp y hệt trận đã lưu
- [x] Chơi online với bạn bè: lockstep qua WebRTC, không cần máy chủ (host gửi mã mời, bạn bè gửi lại mã trả lời); tới 8 người kể cả máy; host tạm dừng và đặt tốc độ cho mọi người; hai bên so dấu vân tay của trận để phát hiện lệch
- [x] Online: mã phòng 6 số (ghép qua máy chủ công cộng miễn phí của PeerJS); báo rõ khi không nối được; mã dài vẫn giữ làm dự phòng
- [x] Online: máy chủ TURN riêng (Metered) đặt lúc build từ biến của repo, nên mạng chặt (NAT đối xứng, CGNAT, 4G) vẫn nối được; màn hình chính và phòng chờ kiểu bản gốc (8 ghế, tên, dân tộc, đội, Ready, chat, Settings của host), chơi không cần máy
- [x] Online: mọi người chịu cùng một độ trễ ngắn như bản gốc (mỗi người tự xếp lệnh của mình vào lượt phía trước; độ trễ tự đo theo mạng, khoảng 200 đến 300 ms), lính bước đi ngay trên màn hình khi ra lệnh; host tạm dừng thì mọi máy dừng ở cùng một lượt
- [x] Online: chat trong trận (Enter); người rời trận thì máy (mức Moderate) chơi thay từ cùng một lượt trên mọi máy
- [x] Online: rớt mạng thì vào lại được trận đang chơi (nút Rejoin, hoặc Multiplayer → Rejoin sau khi tải lại trang, trong 3 giờ): host gửi trận như đang có, máy chơi thay trong lúc vắng mặt rồi trả quân lại
- [x] Online: host rời thì người có số nhỏ nhất làm host thay, những người khác tự vào lại; máy chơi thay cho host cũ; chỉ còn một người thì chơi tiếp một mình

## Chỗ đang khác bản gốc (đã chọn, có thể đổi)

| Khác biệt | Bản gốc | Hiện tại | Ghi chú |
| --- | --- | --- | --- |
| Farm | Chặn đường đi | Mặc định đi xuyên qua được, như bản Definitive Edition | Tùy chọn "Farms block the way" ở màn hình bắt đầu để chơi đúng luật gốc |
| Tộc giả tưởng | Không có | 4 tộc, luôn có trong danh sách | Số riêng ở `data/fantasy.json`, `rules.json` vẫn là số gốc |
| Đổi phím tắt, nút chuột phụ | Không có | Có (tab Keys của Help) | Chữ cái trên bảng lệnh vẫn như bản gốc |
| Rally point, attack-move | Không có | Có | Tiện lợi kiểu hiện đại; có thể làm thành tùy chọn |
| Tốc độ 3x | Tối đa 2x | Có thêm 3x | |
| Full tech tree | Không có | Tùy chọn (tắt sẵn) | Như AoE2: mọi dân tộc có đủ cây công nghệ, bonus vẫn giữ |
| AI mức Khó | Hardest được thêm tài nguyên | Thu nhanh hơn 15% | Cùng ý tưởng là AI được lợi thế, cách thực hiện khác |

Số liệu (`data/rules.json`) là số của Rise of Rome lấy thẳng từ `empires.dat` (2026-10-12): máu, giáp, đòn,
tầm, tốc độ, thời gian nạp, thời gian luyện và xây, giá, tốc độ thu hoạch, sức mang, lượng tài nguyên mỗi mỏ
(vàng 400, đá 250), cá, thú (tốc độ thối của thịt), công nghệ và bonus dân tộc. Tốc độ thu hoạch và xây không
còn nhanh hơn bản gốc 1/3 như ở #65. Những chỗ còn chưa mang sang được: `replica/game/aoe1-engine-spec.md`, mục 8.

## Ranh giới (sẽ không làm)

- Không chép sprite, âm thanh, nhạc, chữ, giao diện hay tên "Age of Empires" của bản gốc. Game chạy công khai trên
  GitHub Pages, nên chép vào là phát tán tài sản có bản quyền. "Giống 100%" ở đây nghĩa là lối chơi và cảm giác,
  không phải tài sản.
- Trình nhập AoE (`npm run import-aoe`) chỉ đọc bản game của người dùng và ghi ra máy của họ; những gì nó ghi ra
  không được đưa vào repo này hay bản deploy (bản lưu riêng: repo private `BronzeDawn-aoe-data`).
- Campaign và trình chỉnh kịch bản: để sau cùng, có thể không làm.

## Ghi chú cho bản Mac

Bản Mac (`Sources/`, `data/rules-mac.json`) vẫn dừng ở bộ luật 2 thời đại cũ, chưa nhận các thay đổi của bản web.
