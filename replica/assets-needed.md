# Danh sách asset cần cho Bronze Dawn

Game hiện vẽ mọi thứ bằng code. Danh sách này là những gì có thể **thay bằng file**. File nào chưa có thì game
dùng tiếp hình vẽ bằng code, nên bạn cứ thay dần từng nhóm, không cần đủ hết mới chạy.

## 0. Trước khi tìm nguồn

**Hai thư mục, hai mức công khai:**

| Thư mục | Commit lên git | Lên GitHub Pages | Dùng cho |
| --- | --- | --- | --- |
| `web/public/assets/` | Có | **Có, ai cũng tải được** | Chỉ asset có giấy phép cho phân phối lại: CC0, CC-BY (kèm ghi công), tự làm, mua có license |
| `web/assets-local/` | Không (gitignore) | Không | Asset chỉ để bạn chơi riêng trên máy mình |

Mỗi file trong `web/public/assets/` cần một dòng trong `web/public/assets/CREDITS.md`: tên file, tác giả, link
nguồn, giấy phép. Không đặt hình, âm thanh hay nhạc trích từ game Age of Empires vào `public/`: chúng sẽ bị phát
tán công khai.

Nguồn gợi ý (kiểm tra giấy phép từng file): OpenGameArt.org (lọc CC0/CC-BY), Kenney.nl (CC0), itch.io (asset
pack có license thương mại hoặc miễn phí), freesound.org (lọc CC0/CC-BY), Pixabay (âm thanh, nhạc).

## 1. Quy cách chung

**Hình (PNG có nền trong suốt):**
- **Ô đất isometric 2:1:** mỗi ô là hình thoi **64 × 32 px**. Mọi sprite vẽ theo cùng tỉ lệ này.
- **Pixel art:** để nguyên kích thước gốc, game tự phóng to giữ nét. Nếu hình đã vẽ sẵn ở tỉ lệ 64 × 32 thì cũng được, ghi rõ trong manifest.
- **Màu người chơi:** vùng nào cần đổi màu theo phe (áo, khiên, cờ) thì tô bằng **các sắc độ của màu tím #FF00FF**
  (từ tối tới sáng). Game thay bằng màu của từng người chơi. Cách khác: kèm một file `*-mask.png` cùng kích thước,
  vùng trắng là vùng đổi màu.
- **Sprite sheet:** mỗi unit một file PNG. Mỗi hàng là một hướng, mỗi cột là một khung hình. Kèm file JSON:
  kích thước khung, điểm neo (chân unit, hoặc đỉnh dưới của hình thoi với công trình), số khung của từng hoạt ảnh,
  thời lượng mỗi khung.
- **Hướng:** 8 hướng. Có thể chỉ vẽ 5 hướng (Nam, Tây Nam, Tây, Tây Bắc, Bắc), game lật ngang ra 3 hướng còn lại,
  giống bản gốc.

**Âm thanh:** OGG hoặc MP3, 44.1 kHz. Hiệu ứng để mono, nhạc để stereo. Chuẩn hóa âm lượng khoảng -14 LUFS (nhạc)
và -12 LUFS (hiệu ứng). Hiệu ứng nên ngắn dưới 1,5 giây và có 2 đến 4 biến thể cho mỗi loại, để nghe không lặp.

**Font:** WOFF2 hoặc TTF, có giấy phép dùng trên web (ví dụ SIL Open Font License).

## 2. Unit (33 loại + villager theo nghề + 4 loài thú)

Mỗi unit có các hoạt ảnh sau, đủ 8 hướng (hoặc 5 hướng lật):

| Hoạt ảnh | Số khung gợi ý | Ghi chú |
| --- | --- | --- |
| Đứng yên | 1 đến 6 | Có thể nhấp nhô nhẹ |
| Đi | 8 đến 12 | |
| Tấn công / làm việc | 6 đến 10 | Có khung "ra đòn" để game khớp tiếng và sát thương |
| Chết | 6 đến 10 | |
| Xác nằm và mục dần | 1 đến 3 | Xác, rồi bộ xương |

Unit chiến đấu (`id` trong game):

- **Barracks:** `clubman`, `axeman`, `slinger`, `short_swordsman`, `broad_swordsman`, `long_swordsman`, `legion`
- **Academy:** `hoplite`, `phalanx`, `centurion`
- **Archery Range:** `bowman`, `improved_bowman`, `composite_bowman`, `chariot_archer`, `horse_archer`,
  `heavy_horse_archer`, `elephant_archer`
- **Stable:** `scout`, `chariot`, `scythe_chariot`, `cavalry`, `heavy_cavalry`, `cataphract`, `war_elephant`,
  `armored_elephant`, `camel_rider`
- **Siege Workshop:** `stone_thrower`, `catapult`, `heavy_catapult`, `ballista`, `helepolis`
- **Temple:** `priest`. Hoạt ảnh làm việc là cải đạo hoặc chữa thương, có vầng sáng.

**Villager theo nghề.** Bản gốc đổi hình villager theo việc đang làm. Cần các bộ sau, mỗi bộ đủ đi, làm việc,
đứng, chết:

| Nghề | Dụng cụ | Bộ "mang hàng" khi đi về kho |
| --- | --- | --- |
| Xây dựng / sửa | Búa | |
| Chặt gỗ | Rìu | Bó gỗ |
| Đào vàng / đá | Cuốc | Bao vàng / bao đá |
| Hái dâu | Giỏ | Giỏ dâu |
| Làm ruộng | Cuốc đất | Bó lúa |
| Săn thú | Giáo (có hoạt ảnh phóng giáo) | Thịt |
| Đánh cá ven bờ | Lưới hoặc giáo | Cá |
| Rảnh | Không | |

**Thú:** `gazelle`, `elephant`, `lion`, `alligator`. Mỗi loài cần đứng, đi hoặc chạy, tấn công (trừ gazelle), chết,
và **xác để xẻ thịt** (2 đến 3 mức, nhỏ dần khi bị lấy thịt).

## 3. Công trình (21 loại)

**Danh sách:** `town_center`, `house`, `granary`, `storage_pit`, `barracks`, `archery_range`, `stable`, `market`,
`farm`, `government_center`, `temple`, `academy`, `siege_workshop`, `wonder`, `watch_tower`, `sentry_tower`,
`guard_tower`, `ballista_tower`, và 3 loại tường `small_wall`, `medium_wall`, `fortification`.

**Kích thước (ô):** Town Center 3×3, House 2×2, các tháp 2×2, Wonder 5×5, tường 1×1, còn lại 3×3.

**Phiên bản cần có:**
- **Thời đại:** Stone Age dùng chung một kiểu (lều, mái tranh). Tool, Bronze, Iron: mỗi thời đại một kiểu,
  **cho mỗi nhóm kiến trúc**. Tổng cộng 1 + 3 × số nhóm kiến trúc phiên bản cho mỗi công trình.
- **Nhóm kiến trúc** (5 nhóm, đúng như game đang dùng): Ai Cập (`egyptian`), Hy Lạp (`greek`), Babylon
  (`babylonian`), Á Đông (`asian`), La Mã (`roman`). Ít nhất nên có 1 nhóm; game dùng nhóm Hy Lạp cho nhóm nào còn thiếu.
- **Wonder:** mỗi nhóm kiến trúc một Wonder riêng.
- **Giai đoạn xây:** 3 hình dùng chung theo kích thước (1×1, 2×2, 3×3, 5×5): cọc móng, móng nửa chừng, giàn giáo.
- **Hư hại:** 3 mức lửa và khói đặt lên công trình (nhẹ, vừa, nặng), có hoạt ảnh.
- **Gạch vụn** sau khi đổ: 1 hình cho mỗi kích thước.
- **Farm:** 4 mức lúa (đầy, 2/3, 1/3, gần hết).
- **Tường:** mỗi cấp tường cần đủ các đoạn nối: thẳng theo 2 trục, góc, chữ T, chữ thập, đầu mút. Tổng cộng 16 kiểu
  ghép theo 4 hướng lân cận cho mỗi cấp.
- **Hình bóng** (tùy chọn): game tự vẽ bóng nếu không có.

## 4. Địa hình và tài nguyên

**Ô đất (64 × 32 px, mỗi loại 3 đến 6 biến thể):** cỏ, đất, cát, nước sâu, nước nông, đất rừng, ruộng cày. Kèm
**mặt nạ chuyển tiếp** giữa các loại đất (bộ 16 hoặc 47 ô). Không có mặt nạ thì game tự hòa màu bằng dither như hiện tại.

**Sau này (giai đoạn 4):** đồi và vách đá theo các hướng dốc.

**Tài nguyên:**

| Thứ | Biến thể / trạng thái |
| --- | --- |
| Cây rừng | 3 đến 4 loại (sồi, thông, cọ, rừng nhiệt đới); gốc cây sau khi chặt |
| Cây đơn lẻ | 1 đến 2 loại, to hơn cây rừng |
| Bụi dâu | Đầy, vơi, hết |
| Mỏ vàng, mỏ đá | 3 mức, nhỏ dần khi bị đào |
| Cá ven bờ | Có hoạt ảnh gợn nước |
| Cá ngoài khơi, cá voi | Sau này, khi có tàu |

## 5. Đạn và hiệu ứng

- **Đạn** (vẽ hướng sang phải, game tự xoay): mũi tên, đá ném (bay xoay), mũi tên nỏ to, giáo, đạn lửa
  (fire galley, sau này).
- **Hiệu ứng** (sprite sheet có hoạt ảnh):
  - bụi khi chạy và khi đá rơi
  - nổ đất khi đá máy bắn đá chạm đất, theo bán kính văng
  - tia sáng khi cải đạo, sáng xanh khi chữa thương
  - lửa và khói cho công trình
  - bụi đổ sập khi công trình bị phá
  - vòng chọn dưới chân unit
  - dấu "đi tới đây"
  - cờ rally point

## 6. Giao diện

- **Nền:** thanh trên cùng, bảng dưới cùng (dạng tileable), khung ô trạng thái, khung minimap, thanh sắt và đinh tán,
  khung cho màn hình bắt đầu, hướng dẫn và thắng/thua.
- **Nút lệnh:** khung nút ở 4 trạng thái (thường, rê chuột, bấm, khóa).
- **Icon nút, 48 × 48 px hoặc 36 × 36 px:**
  - 33 unit và 21 công trình (có thể dùng chung một icon cho các tháp và các tường)
  - **65 công nghệ** (danh sách id trong `data/rules.json`, mục `techs`)
  - 4 thời đại (Tool, Bronze, Iron, và icon "lên đời")
  - lệnh: Build, Repair, Stop, Delete, Stand ground, Attack ground, Attack-move, Convert, Heal, trang sau, quay lại, hủy
- **Icon nhỏ, khoảng 16 × 16 px:**
  - 4 tài nguyên (gỗ, thức ăn, vàng, đá) và dân số
  - chỉ số: tấn công, giáp, giáp xuyên, tầm bắn, máu, faith, mang hàng, tầm nhìn
- **Con trỏ chuột, 32 × 32 px, có điểm nóng:**
  - thường, tấn công (kiếm), thu hoạch (tay), chặt (rìu), đào (cuốc), xây/sửa (búa)
  - cải đạo, chữa thương, không được phép
  - đặt công trình hợp lệ và không hợp lệ (tùy chọn)
- **Chân dung** (tùy chọn): game đang dùng hình unit phóng to. Có tranh chân dung riêng thì đẹp hơn.
- **Font:** 1 font tiêu đề kiểu chữ khắc cổ, 1 font chữ thường dễ đọc ở cỡ nhỏ, tùy chọn 1 font số rõ nét.

## 7. Âm thanh

**Giao diện:** click nút, không đủ tài nguyên / lỗi, unit luyện xong, công trình xây xong, nghiên cứu xong,
lên thời đại (kèn), báo bị tấn công, Wonder được xây / sắp thắng, thắng, thua.

**Làm việc** (có thể lặp): chặt gỗ, đào mỏ, hái dâu, làm ruộng, gõ búa xây, kéo lưới đánh cá.

**Chiến đấu:**
- chém kiếm, đập chùy, rìu
- bắn cung, mũi tên trúng thịt, mũi tên trúng gỗ hoặc đá
- máy bắn đá bật cần, đá rơi nổ đất, nỏ lớn bắn
- voi rống, ngựa hí, ngựa phi, tiếng chiến xa

**Chết:** tiếng người (vài biến thể), ngựa, voi, công trình sụp đổ.

**Tôn giáo:** tiếng thầy tu tụng (tự sáng tác, không dùng câu "wololo" của bản gốc), cải đạo thành công, chữa thương.

**Thú:** gazelle, sư tử gầm, voi hoang, cá sấu.

**Tiếng đáp lời khi chọn hoặc ra lệnh:** villager nam và nữ, lính bộ, lính ngựa, thầy tu (sau này có thêm thuyền).
Mỗi loại 3 đến 5 câu ngắn. Có thể dùng một ngôn ngữ cổ tự chế, hoặc chỉ là tiếng "hừm", "vâng".

**Môi trường:** chim, gió, sóng ven bờ.

**Nhạc:** 4 đến 8 bản nền dài 2 đến 4 phút, lặp được; 1 bản cho màn hình bắt đầu; nhạc thắng và nhạc thua.

## 7b. Dân tộc Lạc Việt (`lac_viet`)

Lạc Việt dùng **kiến trúc Á Đông** (`asian`), giống bản Return of Rome (Wonder cũng là Wonder Á Đông chung).
Vì vậy mọi asset `asian` ở mục 3 đã đủ cho Lạc Việt. Phần dưới là tùy chọn, để Lạc Việt có nét riêng.
Thiếu file nào thì game lùi về `asian` rồi về hình vẽ bằng code.

**Đã có, vẽ bằng code:** khung giao diện (thanh trên, bảng dưới) khắc hoa văn **mặt trống đồng Đông Sơn**:
ngôi sao nhiều cánh ở giữa, vòng tròn tiếp tuyến có chấm, dải răng lược và chim mỏ dài bay. Màu đồng xanh.
Muốn thay bằng file thì cần một ảnh nền lặp ngang 200 × 63 px (vẽ ở tỉ lệ 2), cùng bố cục với các kiểu khác.

**Công trình riêng (tùy chọn).** Trong manifest dùng khóa `lac_viet` cạnh các khóa kiến trúc; game tìm
`lac_viet` trước, rồi `asian`. Gợi ý theo thứ tự ưu tiên, mỗi cái cho Tool, Bronze, Iron:
1. `house`: nhà sàn mái cong hình thuyền (như hình nhà khắc trên trống đồng).
2. `town_center`: nhà sàn lớn, mái võng, đầu hồi cong.
3. `temple`: nhà sàn cao có trống đồng đặt trước.
4. `granary`, `storage_pit`: kho lúa sàn cao.
5. `wonder`: tùy chọn. Bản gốc dùng Wonder Á Đông chung; có thể làm một đền đá/thành Cổ Loa xoắn ốc.

```json
"buildings": { "house": { "lac_viet": { "tool": { "file": "buildings/lac_viet/house-tool.png" } },
                          "asian":    { "tool": { "file": "buildings/asian/house-tool.png" } } } }
```

**Unit riêng (tùy chọn).** Khóa `lac_viet/<unit id>` (và `lac_viet/villager:axe`...) được tìm trước khóa chung.
Lạc Việt mạnh nhất ở Archery Range, nên nên vẽ trước: `lac_viet/villager` (khố, tóc búi, mũ lông chim khi đi lính),
`lac_viet/bowman`, `lac_viet/improved_bowman`, `lac_viet/composite_bowman` (nỏ), `lac_viet/chariot_archer`,
`lac_viet/elephant_archer`, rồi lính Barracks (giáo, rìu đồng xòe). **Không cần** vẽ các unit Lạc Việt không
có: `phalanx`, `centurion`, `legion`, `camel_rider`, `cataphract`, `helepolis`.

**Âm thanh và nhạc (tùy chọn).** Hiện game chưa đổi tiếng theo dân tộc; nếu thêm, cần: tiếng đáp lời
(villager, lính, thầy tu) bằng tiếng tự chế, 3 đến 5 câu mỗi loại; một bản nhạc nền có trống đồng, sáo, đàn đá.
Lưu ý: đừng dùng bản thu của game gốc.

**Icon (tùy chọn):** biểu tượng dân tộc 48 × 48 px (mặt trống đồng thu nhỏ), dùng cho màn hình chọn dân tộc sau này.

## 8. Sau này (khi làm tàu, giai đoạn 3)

- **Công trình:** Dock, đủ 5 nhóm kiến trúc × các thời đại.
- **Tàu**, mỗi loại cần đi, tấn công (nếu có), chìm:
  - fishing boat, fishing ship
  - trade boat, merchant ship
  - light transport, heavy transport
  - scout ship, war galley, trireme
  - catapult trireme, juggernaught, fire galley
- **Âm thanh:** sóng vỗ thân tàu, tàu chìm.

## 9. Bộ nạp asset (đã có: `web/src/game/assets.ts`)

Bỏ file vào `web/public/assets/` (công khai, lên GitHub Pages) hoặc `web/assets-local/` (chỉ dev server trên
máy này, không commit), cùng một file `manifest.json` ở gốc thư mục đó. Đường dẫn trong manifest tính từ gốc
thư mục. Có cả hai thì `assets-local` thêm vào / ghi đè lên `assets`. Thiếu mục nào thì game dùng hình hoặc
tiếng vẽ bằng code, nên có thể thay từng phần.

```json
{
  "units": {
    "villager":     { "file": "units/villager.png", "frame": [64, 64], "anchor": [32, 58], "directions": 5,
                      "anims": { "idle": { "row": 0, "frames": 1 }, "walk": { "row": 5, "frames": 8, "fps": 10 },
                                 "work": { "row": 10, "frames": 6, "fps": 8 } } },
    "villager:axe": { "file": "units/woodcutter.png", "...": "cùng cách ghi, dùng khi villager cầm rìu" }
  },
  "buildings": {
    "house": { "egyptian": { "stone": { "file": "buildings/egyptian/house-stone.png", "anchor": [64, 95] },
                             "tool":  { "file": "buildings/egyptian/house-tool.png" } },
               "default": { "file": "buildings/house.png" } }
  },
  "resources": { "tree": [{ "file": "resources/tree-1.png", "anchor": [24, 60] }, { "file": "resources/tree-2.png" }] },
  "terrain": { "grass": ["terrain/grass-1.png", "terrain/grass-2.png"], "water": ["terrain/water-1.png"] },
  "icons": { "villager": "ui/icons/villager.png", "build": "ui/icons/build.png" },
  "resourceIcons": { "wood": "ui/wood.png", "food": "ui/food.png", "gold": "ui/gold.png", "stone": "ui/stone.png" },
  "cursors": { "sword": { "file": "ui/cursor-sword.png", "hot": [2, 2] } },
  "sfx": { "chop": ["audio/sfx/chop-1.ogg", "audio/sfx/chop-2.ogg"], "voice-villager": ["audio/voice/v-1.ogg"] },
  "music": ["audio/music/track-1.ogg"],
  "credits": [{ "what": "Villager sprites", "author": "Tên tác giả", "license": "CC-BY 3.0", "url": "https://..." }]
}
```

- **Unit theo dân tộc:** khóa `lac_viet/bowman` được dùng trước khóa `bowman` cho người chơi Lạc Việt.
- **Sprite sheet unit:** mỗi hàng một hướng, theo chiều kim đồng hồ bắt đầu từ hướng nhìn ra người chơi: S, SW, W,
  NW, N, NE, E, SE. `directions: 5` thì game lật ngang 3 hướng còn lại. `row` của mỗi hoạt ảnh là hàng của hướng S;
  các hướng tiếp theo nằm ở các hàng ngay dưới. `anchor` là điểm chân unit trong một khung.
- **Công trình:** tìm theo dân tộc nếu có (`lac_viet`), rồi kiểu kiến trúc, rồi thời đại (`stone`, `tool`, `bronze`, `iron`); thiếu thì lùi về thời
  đại trước, rồi kiểu `greek`, rồi `default`. `anchor` mặc định là giữa cạnh dưới (đỉnh dưới của hình thoi).
  Giai đoạn đang xây vẫn dùng hình vẽ bằng code.
- **Màu người chơi:** vùng tô bằng các sắc tím `#FF00FF` được đổi sang màu phe, giữ sáng tối.
- **Âm thanh:** tên hiệu ứng giống trong `sound.ts` (`chop`, `mine`, `sword`, `bow`, `collapse`, `complete`,
  `alarm`, `ageUp`, `click`...). Giọng unit: `voice-villager`, `voice-soldier`, `voice-rider`, `voice-priest`,
  `voice-siege`, thêm hậu tố `-ack` cho câu trả lời khi nhận lệnh.
- **`scale`** (tùy chọn) ở mọi hình: số đơn vị màn hình cho mỗi điểm ảnh của hình, mặc định 1.
- **Credits:** mọi file trong `public/assets/` phải có một dòng trong `credits`; game hiện chúng ở Menu → Credits.
