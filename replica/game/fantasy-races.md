# Đề xuất: các tộc giả tưởng (Elf, Dwarf, Centaur, Beastfolk)

Trạng thái: **đợt 1 (4 tộc ở mục 2) đã vào game**, luôn có trong danh sách chọn dân tộc, nhóm "Fantasy". Theo ý
chủ repo, **không có nút bật tắt** (mục 5.1 cũ): để thử cả bốn tộc trong mọi trận. Số đang dùng nằm ở
`data/fantasy.json` (gộp vào luật lúc nạp, `web/src/core/data.ts`); tộc nhân mã trước đây tên Sagittarian, nay là Centaur (id `centaur`); vài số đã chỉnh sau giả lập, xem mục 6. Mọi id
(unit, stat, tech) giữ tiếng Anh như trong `data/rules.json`.

Nguồn dữ liệu: `data/rules.json` (17 dân tộc, số của Rise of Rome từ `empires.dat`, cộng Lac Viet), cách áp dụng hiệu ứng
trong `web/src/core/stats.ts` (`Mods.apply`, `Mods.fold`), cách AI đọc bonus trong `web/src/core/civbent.ts`, và công cụ
cân bằng `replica-skill/replica-game-design/balance.py`.

## 0. Bộ máy hiện có làm được gì

| Thứ cần | Có sẵn? | Ghi chú |
| --- | --- | --- |
| `stat` trên `cost`, `hp`, `speed`, `attack_cooldown`, `los`, `range`, `armor`, `pierce_armor`, `attack`, `train_time`, `build_time`, `pop` | Có | `op`: `add`, `mul`, `set` (set thắng, rồi add, rồi mul). Target: `units` (id), `tags` (phải khớp **tất cả** tag), `buildings`, `buildings_tags` (khớp bất kỳ, `"!tag"` loại, `"*"` là mọi nhà) |
| `gather` (rate, carry, `kind`: farm/hunt/forage/fish; `resource: "all"`) | Có | |
| `farm_food`, `mine_yield`, `carry`, `heal`, `conversion` (chance/regen/resist), `flag`, `upgrade` | Có | `flag` chỉ có tác dụng khi code đọc tên flag đó (`free_tribute`, `ballistics`, `martyrdom`, `monotheism`) |
| `disabled` (unit, tech, building) | Có | Tắt một building tắt luôn mọi thứ nó luyện (`world.ts`) |
| Unit/tech **riêng của một tộc** | **Không** | Mọi unit trong `units` đều mở cho mọi dân tộc nếu không bị `disabled`. Rise of Rome không có unit riêng, nên chưa từng cần |
| Bonus cho đồng minh (team bonus) | **Không** | Rise of Rome không có; `Mods.setCiv` chỉ áp cho chính người chơi |
| Hình unit theo dân tộc | **Không** | `manifest.json` có một hình cho mỗi unit id; kiểu nhà theo `arch` chỉ có ở hình vẽ thủ tục `web/src/game/art.ts` (5 bộ: `egyptian`, `babylonian`, `greek`, `asian`, `roman`) |
| Tàng hình, hồi máu, bắn khi chạy, xây trên vách đá | **Không** | Xem phần "Cần bộ máy mới" của từng tộc |

AI (`civBent`) chỉ tính hiệu ứng `stat` trên từng unit (máu, đòn, tốc độ đánh, giá...), không thấy unit riêng mạnh vì
bản thân nó. Unit riêng cần một mức sàn trong `civBent` (mục 5).

## 1. Nguyên tắc thiết kế

1. **Mỗi tộc là một lối chơi**, nói được trong một câu: Elf = cung thủ gỗ, không cần vàng; Dwarf = bộ binh thép và đá,
   chậm; Centaur = cung kỵ từ thời Đồng; Beastfolk = đánh sớm bằng bộ binh nhanh và thú săn.
2. **Cùng biên độ với Rise of Rome.** Bonus kinh tế ×1.15–×1.5 (Egyptian vàng ×1.44, Persian săn ×1.67, Lac Viet hái
   ×1.15); bonus quân ×1.25–×2 máu (Egyptian chariot ×1.33, Hittite máy ×2), giảm giá ×0.7–×0.8 (Yamato kỵ ×0.75), tốc
   độ +0.2–+0.5. Mỗi tộc 4–5 hiệu ứng, như dân tộc gốc (2–4, Palmyran 12).
3. **Mạnh chỗ nào thì yếu chỗ khác**: danh sách `disabled` dài như dân tộc thật (mỗi dân tộc gốc tắt 20–35 thứ; test
   hiện tại đòi hơn 10), cộng một điểm trừ thật khi cần (như Palmyran người dân ×1.5 giá).
4. **Giữ oẳn tù tì của AoE1:** bộ binh > kỵ/chariot nhẹ; cung > bộ binh chậm; kỵ > cung và máy; lạc đà > kỵ; thầy tu >
   voi và quân đắt; máy > nhà và đám đông. Unit riêng chỉ thay một mắt xích, không xóa mắt xích nào. Mọi unit riêng
   phải có ít nhất một khắc chế trong bảng của `balance.py` (mục 2.5).
5. **Không đụng chế độ mặc định.** Tộc giả tưởng chỉ hiện khi bật tùy chọn ở màn hình bắt đầu (mục 5).

## 2. Bốn tộc

### 2.1 Elf: cung thủ của rừng

**Bản sắc:** sống trong rừng, gỗ là tất cả. Cung thủ bắn xa, nhìn xa, không cần vàng; nhà cửa mỏng; không có xe, voi,
kỵ nặng. Chơi: dựng nhanh Archery Range, giữ khoảng cách, dùng rừng làm tường.

| Hiệu ứng | Elf | Mốc so sánh trong RoR |
| --- | --- | --- |
| Gỗ | ×1.2, carry +2 | Phoenician ×1.36, carry +3 |
| Hái quả | ×1.2 | Lac Viet ×1.15 |
| Cung bộ (`foot_archer`) tầm | +1 | Minoan composite +2 |
| Cung bộ tầm nhìn | +2 | Choson tháp +2 |
| Điểm trừ: máu mọi công trình | ×0.85 | Palmyran người dân ×1.5 giá |

```json
{"id": "elf", "name": "Elf", "arch": "asian", "fantasy": true, "effects": [
  {"type": "gather", "resource": "wood", "rate": 1.2, "carry": 2},
  {"type": "gather", "resource": "food", "rate": 1.2, "carry": 0, "kind": "forage"},
  {"type": "stat", "stat": "range", "op": "add", "value": 1, "target": {"tags": ["foot_archer"]}},
  {"type": "stat", "stat": "los", "op": "add", "value": 2, "target": {"tags": ["foot_archer"]}},
  {"type": "stat", "stat": "hp", "op": "mul", "value": 0.85, "target": {"buildings_tags": ["*"]}}],
 "disabled": ["composite_bowman", "composite_bow", "chariot", "chariot_archer", "scythe_chariot", "scythe_chariot_tech",
  "heavy_cavalry", "heavy_cavalry_tech", "cataphract", "cataphract_tech", "war_elephant", "armored_elephant",
  "armored_elephant_tech", "elephant_archer", "camel_rider", "heavy_catapult", "heavy_catapult_tech", "helepolis",
  "helepolis_tech", "legion", "legion_tech", "centurion", "centurion_tech", "iron_shield", "tower_shield",
  "chain_armor_infantry", "metallurgy", "fortification", "fortification_tech", "siegecraft", "juggernaught", "juggernaught_tech"]}
```

**Unit riêng** (số gốc, chưa cộng bonus tộc; cột "Elf" là sau bonus):

| | glade_archer | glade_archer (Elf) | composite_bowman | grove_warden | war_elephant |
| --- | --- | --- | --- | --- | --- |
| age, trained_at | bronze, archery_range | | bronze, archery_range (cần 2 tech, 320f 180w) | iron, temple | iron, stable |
| cost | 40f 40w | | 40f 20g | 100f 120w | 170f 40g |
| train_time | 34 | | 30 | 50 | 50 |
| hp | 45 | | 45 | 500 | 600 |
| attack / cooldown | 5 / 1.4 | | 5 / 1.4 | 14 / 1.8 | 15 / 1.5 |
| armor / pierce | 0 / 1 | | 0 / 0 | 2 / 4 | 0 / 0 |
| range / los | 7 / 9 | **8 / 11** | 7 / 9 | 0 / 5 | 0 / 5 |
| speed | 1.3 | | 1.2 | 0.8 | 0.9 |
| class, tags | archer; archery, missile, foot_archer, military | | archer | `treant` (class mới); treant, melee, military | elephant |
| bonus | | | | building +15 | trample 2 |

- `glade_archer` thay dòng composite: không tốn vàng, không cần nâng cấp, nhưng mỗi lính đắt hơn (80 so với 60). Elf
  vẫn có `bowman`, `improved_bowman`.
- `grove_warden` (người cây): chậm, chịu tên rất tốt, phá nhà; thua bộ binh nặng và voi giáp. Không tốn vàng.

**Tech riêng:**

```json
{"id": "moonlit_volley", "name": "Moonlit Volley", "age": "iron", "building": "archery_range",
 "cost": {"food": 300, "wood": 250}, "time": 90, "requires": [], "civ": "elf",
 "effects": [{"type": "stat", "stat": "attack_cooldown", "op": "mul", "value": 0.85, "target": {"tags": ["foot_archer"]}}]}
```

(Assyrian có sẵn cung nạp 1.1 thay 1.4, tức ×0.79, không tốn gì; đây là ×0.85 và phải mua ở Iron.)

| Mục | Đề xuất |
| --- | --- |
| Team bonus | Cung bộ của đồng minh +1 tầm nhìn |
| AI (civbent) | Hiện `civBent` chỉ ra archery_range 0.10 (từ +1 tầm của bowman). Thêm sàn cho unit riêng (mục 5) thì archery_range lên ~0.4: mở Archery Range trước, nhiều người chặt gỗ, ít vàng |
| Cần bộ máy mới | (a) unit/tech riêng (`civ`), nhỏ, ~0.5 ngày, chung cho cả 4 tộc; (b) class `treant` chỉ là dữ liệu; (c) **tùy chọn** tech `forest_veil`: lính đứng cạnh cây thì địch chỉ thấy trong 2 ô, trừ lúc đang bắn. Sửa `fog.ts` và cách AI chọn mục tiêu: **vừa, 2–3 ngày** |

### 2.2 Dwarf: thợ mỏ, thép và đá

**Bản sắc:** đào vàng và đá nhanh, bộ binh giáp dày nhưng chân ngắn, máy công thành bền. Không có ngựa, voi, lạc đà; đi
biển kém. Chơi: tường đá, bộ binh và máy đẩy chậm mà chắc.

| Hiệu ứng | Dwarf | Mốc so sánh |
| --- | --- | --- |
| Vàng | ×1.25, carry +2 | Egyptian ×1.44, carry +2 |
| Đá | ×1.25, carry +2 | Babylonian ×1.44, carry +3 |
| Bộ binh cận chiến ở barracks: giáp | +1 | Macedonian academy pierce +2 |
| Máu máy công thành | ×1.5 | Hittite ×2 |
| Điểm trừ: tốc độ bộ binh barracks | −0.1 | |

```json
{"id": "dwarf", "name": "Dwarf", "arch": "babylonian", "fantasy": true, "effects": [
  {"type": "gather", "resource": "gold", "rate": 1.25, "carry": 2},
  {"type": "gather", "resource": "stone", "rate": 1.25, "carry": 2},
  {"type": "stat", "stat": "armor", "op": "add", "value": 1, "target": {"tags": ["barracks", "melee"]}},
  {"type": "stat", "stat": "speed", "op": "add", "value": -0.1, "target": {"tags": ["barracks", "melee"]}},
  {"type": "stat", "stat": "hp", "op": "mul", "value": 1.5, "target": {"units": ["stone_thrower", "catapult", "heavy_catapult", "ballista", "helepolis"]}}],
 "disabled": ["chariot", "scythe_chariot", "scythe_chariot_tech", "cavalry", "heavy_cavalry", "heavy_cavalry_tech",
  "cataphract", "cataphract_tech", "war_elephant", "armored_elephant", "armored_elephant_tech", "camel_rider",
  "chariot_archer", "horse_archer", "heavy_horse_archer", "heavy_horse_archer_tech", "elephant_archer",
  "composite_bowman", "composite_bow", "astrology", "mysticism", "polytheism", "monotheism", "aristocracy",
  "trireme", "trireme_tech", "catapult_trireme", "catapult_trireme_tech", "juggernaught", "juggernaught_tech", "fire_galley"]}
```

Chuồng ngựa chỉ còn `scout`: điểm yếu lớn nhất là không có quân nhanh đuổi máy và cung địch.

| | ironclad | ironclad (Dwarf) | broad_swordsman | deep_arbalest | composite_bowman |
| --- | --- | --- | --- | --- | --- |
| age, trained_at | bronze, barracks | | bronze, barracks | bronze, archery_range | bronze, archery_range |
| cost | 45f 25g | | 35f 15g | 40f 25w 20g | 40f 20g |
| train_time | 30 | | 26 | 34 | 30 |
| hp | 85 | | 70 | 50 | 45 |
| attack / cooldown | 8 / 1.5 | | 9 / 1.5 | 8 / 2.0 | 5 / 1.4 |
| armor / pierce | 3 / 2 | **4 / 2** | 1 / 0 | 1 / 1 | 0 / 0 |
| range / los | 0 / 4 | | 0 / 4 | 6 / 8 | 7 / 9 |
| speed | 1.0 | **0.9** | 1.2 | 1.0 | 1.2 |
| tags | barracks, infantry, melee, military | | | archery, missile, foot_archer, military | |

- `ironclad`: tường người, chịu cả đòn lẫn tên; chậm nên cung và máy thả diều được.
- `deep_arbalest` (nỏ): đòn 8 xuyên giáp, nạp chậm, tầm ngắn hơn; thay dòng composite.

**Tech riêng:**

```json
{"id": "deep_delving", "name": "Deep Delving", "age": "iron", "building": "market",
 "cost": {"food": 250, "wood": 150}, "time": 75, "requires": [], "civ": "dwarf",
 "effects": [{"type": "mine_yield", "resource": "gold", "value": 1.25}, {"type": "mine_yield", "resource": "stone", "value": 1.25}]}
```

(Bằng `coinage` gốc: vàng mỗi mỏ ×1.25.)

| Mục | Đề xuất |
| --- | --- |
| Team bonus | Tường và tháp của đồng minh +10% máu |
| AI (civbent) | Hiện: siege_workshop 0.5 (stone_thrower), barracks 0.04. Có sàn unit riêng thì barracks ~0.35: barracks trước, nhiều thợ vàng, rồi Siege Workshop |
| Cần bộ máy mới | (a) `civ` (chung); (b) **không nên** làm "xây trong núi / đường hầm": đụng lưới, tìm đường, sinh bản đồ, **lớn, 1–2 tuần**. Nếu muốn hương vị núi: Dwarf xây được nhà sát vách đá (nới luật đặt nhà): nhỏ, ~1 ngày |

### 2.3 Centaur: tộc nhân mã cung thủ

**Bản sắc:** nửa người nửa ngựa, sống bằng săn và cung. Có cung kỵ từ thời Đồng (dân khác phải chờ Iron), người dân chạy
nhanh. Không có bộ binh kiếm, không Academy, không xe, voi, thành lũy. Chơi: săn, quấy, thả diều; thua nếu bị dồn vào
thế đánh trận đứng với bộ binh nặng.

| Hiệu ứng | Centaur | Mốc so sánh |
| --- | --- | --- |
| Tốc độ người dân | +0.3 | Assyrian, Yamato +0.2 |
| Săn | ×1.33, carry +2 | Persian ×1.67, carry +3 |
| Giá cung kỵ (`horse_archer`, `heavy_horse_archer`, `centaur_archer`) | ×0.8 | Yamato kỵ ×0.75 |
| Tầm cung kỵ (`mounted` + `missile`) | +1 | Hittite cung +1 đòn |

```json
{"id": "centaur", "name": "Centaur", "arch": "greek", "fantasy": true, "effects": [
  {"type": "stat", "stat": "speed", "op": "add", "value": 0.3, "target": {"units": ["villager"]}},
  {"type": "gather", "resource": "food", "rate": 1.33, "carry": 2, "kind": "hunt"},
  {"type": "stat", "stat": "cost", "op": "mul", "value": 0.8, "target": {"units": ["horse_archer", "heavy_horse_archer", "centaur_archer"]}},
  {"type": "stat", "stat": "range", "op": "add", "value": 1, "target": {"tags": ["mounted", "missile"]}}],
 "disabled": ["academy", "short_swordsman", "short_sword", "broad_swordsman", "broad_sword", "long_swordsman", "long_sword",
  "legion", "legion_tech", "improved_bowman", "improved_bow", "composite_bowman", "composite_bow", "chariot",
  "chariot_archer", "scythe_chariot", "scythe_chariot_tech", "war_elephant", "armored_elephant", "armored_elephant_tech",
  "elephant_archer", "fortification", "fortification_tech", "guard_tower", "guard_tower_tech", "ballista_tower",
  "ballista_tower_tech", "heavy_catapult", "heavy_catapult_tech", "helepolis", "helepolis_tech",
  "catapult_trireme", "catapult_trireme_tech", "juggernaught", "juggernaught_tech"]}
```

| | centaur_archer | centaur_archer (Sag.) | chariot_archer | horse_archer | hoof_lancer | cavalry |
| --- | --- | --- | --- | --- | --- | --- |
| age, trained_at | bronze, archery_range | | bronze, archery_range | iron, archery_range | bronze, stable | bronze, stable |
| cost | 70f 45g | **56f 36g** | 40f 70w | 50f 70g | 70f 50g | 70f 80g |
| train_time | 36 | | 40 | 40 | 38 | 40 |
| hp | 70 | | 70 | 60 | 130 | 150 |
| attack / cooldown | 5 / 1.5 | | 4 / 1.5 | 7 / 1.5 | 8 / 1.5 | 8 / 1.5 |
| armor / pierce | 0 / 1 | | 0 / 0 | 0 / 2 | 0 / 1 | 0 / 0 |
| range / los | 6 / 9 | **7 / 9** | 7 / 9 | 7 / 9 | 0 / 5 | 0 / 4 |
| speed | 2.0 | | 2.0 | 2.2 | 2.1 | 2.0 |
| class | `horse_archer` (lạc đà +8 đánh nó) | | chariot | horse_archer | cavalry | cavalry |
| bonus | | | priest +8 | | archer +4, horse_archer +4 | infantry +5 |

- `centaur_archer` ở thời Đồng mạnh hơn chariot_archer nhưng yếu hơn horse_archer thời Iron. Class `horse_archer` để
  lạc đà của địch vẫn khắc nó.
- `hoof_lancer`: kỵ rẻ vàng chuyên săn cung và máy. Centaur vẫn có `horse_archer` → `heavy_horse_archer`, `scout`,
  `cavalry` → `cataphract`, `camel_rider`, `slinger`, `bowman`.

**Tech riêng:**

```json
{"id": "galloping_volley", "name": "Galloping Volley", "age": "iron", "building": "archery_range",
 "cost": {"food": 400, "gold": 250}, "time": 100, "requires": [], "civ": "centaur",
 "effects": [{"type": "stat", "stat": "attack", "op": "add", "value": 1, "target": {"tags": ["mounted", "missile"]}}]}
```

| Mục | Đề xuất |
| --- | --- |
| Team bonus | Quân cưỡi của đồng minh +1 tầm nhìn |
| AI (civbent) | Hiện: archery_range 0.33 (centaur_archer). Đã đúng hướng: AI mở Archery Range, săn thú; nên thêm luật AI "đừng đánh trận đứng với hoplite" (chỉ là gợi ý cho `ai.ts`) |
| Cần bộ máy mới | (a) `civ` (chung); (b) **người dân là nhân mã không cần bộ máy**, chỉ cần hình (khuyên làm người dân dáng satyr hai chân để dùng lại bộ khung người dân, xem mục 3); (c) **tùy chọn** bắn khi đang chạy: đổi vòng lặp lệnh và đòn đánh, **lớn, ~1 tuần**, không nên làm ở đợt đầu |

### 2.4 Beastfolk: tộc thú nhân (sói, gấu, cáo...)

**Bản sắc:** thợ săn bẩm sinh, lính bộ chạy nhanh và luyện nhanh, đánh sớm. Kỹ thuật kém: không Academy, máy công thành
chỉ có `stone_thrower`, không thành lũy, ít tech đền. Chơi: rush Tool Age bằng `wolfkin_raider`, rồi giữ áp lực.

| Hiệu ứng | Beastfolk | Mốc so sánh |
| --- | --- | --- |
| Săn | ×1.5, carry +2 | Persian ×1.67, carry +3 |
| Máu người dân | +10 | Sumerian +15 |
| Tốc độ bộ binh cận chiến barracks | +0.2 | Greek hoplite +0.3 |
| Thời gian luyện ở barracks | ×0.8 | Lac Viet mọi quân ×0.8 |

```json
{"id": "beastfolk", "name": "Beastfolk", "arch": "egyptian", "fantasy": true, "effects": [
  {"type": "gather", "resource": "food", "rate": 1.5, "carry": 2, "kind": "hunt"},
  {"type": "stat", "stat": "hp", "op": "add", "value": 10, "target": {"units": ["villager"]}},
  {"type": "stat", "stat": "speed", "op": "add", "value": 0.2, "target": {"tags": ["barracks", "melee"]}},
  {"type": "stat", "stat": "train_time", "op": "mul", "value": 0.8, "target": {"tags": ["barracks"]}}],
 "disabled": ["academy", "legion", "legion_tech", "composite_bowman", "composite_bow", "chariot", "chariot_archer",
  "scythe_chariot", "scythe_chariot_tech", "elephant_archer", "cataphract", "cataphract_tech", "armored_elephant",
  "armored_elephant_tech", "catapult", "catapult_tech", "heavy_catapult", "heavy_catapult_tech", "ballista", "helepolis",
  "helepolis_tech", "fortification", "fortification_tech", "guard_tower", "guard_tower_tech", "ballista_tower",
  "ballista_tower_tech", "astrology", "monotheism", "afterlife", "architecture", "engineering", "alchemy",
  "catapult_trireme", "catapult_trireme_tech", "juggernaught", "juggernaught_tech"]}
```

| | wolfkin_raider | wolfkin (Beastfolk) | axeman | bearkin_brute | bearkin (Beastfolk) | legion |
| --- | --- | --- | --- | --- | --- | --- |
| age, trained_at | tool, barracks | | tool, barracks | iron, barracks | | iron, barracks (tech 1400f 600g) |
| cost | 60f | | 50f | 70f 40g | | 35f 15g |
| train_time | 24 | **19.2** | 26 | 40 | **32** | 26 |
| hp | 50 | | 50 | 220 | | 160 |
| attack / cooldown | 5 / 1.3 | | 5 / 1.5 | 16 / 2.0 | | 13 / 1.5 |
| armor / pierce | 0 / 0 | | 0 / 0 | 1 / 3 | | 2 / 0 |
| speed / los | 1.6 / 5 | **1.8** / 5 | 1.2 / 4 | 1.0 / 4 | **1.2** / 4 | 1.2 / 4 |
| tags | barracks, infantry, melee, military | | | (giống wolfkin) | | |
| bonus | | | | building +8 | | |

- `wolfkin_raider`: quấy người dân và cung sớm; đánh tay đôi thua axeman (0.80).
- `bearkin_brute`: bộ binh chịu tên (pierce 3) và phá nhà; thua legion và centurion, Beastfolk không có Academy nên đây
  là quân chủ lực Iron của họ.

**Tech riêng:**

```json
{"id": "blood_of_the_wild", "name": "Blood of the Wild", "age": "iron", "building": "barracks",
 "cost": {"food": 300, "gold": 150}, "time": 90, "requires": [], "civ": "beastfolk",
 "effects": [{"type": "stat", "stat": "hp", "op": "mul", "value": 1.15, "target": {"tags": ["barracks", "melee"]}}]}
```

(Như `nobility` gốc: kỵ ×1.15 máu, 175f 120g.)

| Mục | Đề xuất |
| --- | --- |
| Team bonus | Thợ săn của đồng minh ×1.1 |
| AI (civbent) | Hiện: barracks 0.17 (bearkin_brute nhờ +0.2 tốc độ). Có sàn unit riêng thì barracks ~0.5: AI mở barracks sớm, rush Tool Age |
| Cần bộ máy mới | (a) `civ` (chung); (b) **tùy chọn** hồi máu: trường `regen` (máu/giây) trên unit, chỉ hồi khi 5 giây không đánh, tick trong `world.ts`; hiệu ứng mới `{"type": "stat", "stat": "regen"}`. **Nhỏ, ~1 ngày** (cộng test). Hợp với `blood_of_the_wild` hoặc thay nó |

### 2.5 Số từ công cụ cân bằng

Cách làm: script nháp (ngoài repo) tạo một `rules.json` tạm, thêm 8 unit riêng **đã cộng bonus tộc**, rồi chạy
`python3 -I replica-skill/replica-game-design/balance.py <tạm>.json --json`. Kết quả: 0 lỗi, 1 cảnh báo (`scout` vô
dụng ở Tool Age, có sẵn từ trước). Công cụ dùng luật bình phương Lanchester với **cùng số tài nguyên**: số > 1.1 là hàng
thắng cột, < 0.91 là thua. Tầm bắn và tốc độ không có trong công thức, nên cung thủ trong bảng là mức sàn.

**Tool Age**

| hàng vs cột | axeman | slinger | bowman | scout | bị khắc bởi |
| --- | --- | --- | --- | --- | --- |
| wolfkin_raider | 0.80 | 4.01 | 2.56 | 4.45 | axeman |
| *axeman (mốc)* | – | 5.00 | 3.20 | 5.56 | (không có) |

**Bronze Age**

| hàng vs cột | broad_swordsman | hoplite | slinger | composite_bowman | chariot_archer | chariot | cavalry | camel_rider |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| glade_archer | 0.15 | 0.18 | 0.75 | 0.70 | 2.17 | 0.54 | 0.71 | 0.85 |
| deep_arbalest | 0.19 | 0.22 | 1.04 | 0.78 | 2.39 | 0.69 | 0.89 | 1.12 |
| *composite_bowman (mốc)* | 0.27 | 0.33 | 1.00 | – | 2.89 | 0.96 | 1.26 | 1.51 |
| centaur_archer | 0.16 | 0.20 | 2.48 | 0.77 | 2.38 | 0.59 | 0.78 | 0.40 |
| *chariot_archer (mốc)* | 0.09 | 0.11 | 0.58 | 0.35 | – | 0.33 | 0.43 | 0.31 |
| ironclad | 0.87 | 0.33 | 13.88 | 3.45 | 11.99 | 4.63 | 2.31 | 9.38 |
| *broad_swordsman (mốc)* | – | 0.58 | 12.60 | 3.76 | 10.89 | 4.20 | 3.15 | 6.81 |
| hoof_lancer | 0.25 | 0.13 | 7.22 | 2.02 | 4.16 | 1.03 | 1.35 | 0.70 |
| *cavalry (mốc)* | 0.32 | 0.10 | 2.67 | 0.80 | 2.30 | 0.76 | – | 0.52 |
| wolfkin_raider | 0.25 | 0.08 | 4.01 | 1.20 | 3.46 | 1.14 | 0.92 | 1.81 |

**Iron Age**

| hàng vs cột | legion | centurion | composite_bowman | heavy_horse_archer | cataphract | armored_elephant | camel_rider | scythe_chariot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| grove_warden | 0.15 | 0.12 | 9.00 | 4.82 | 1.18 | 0.47 | 4.07 | 1.23 |
| bearkin_brute | 0.25 | 0.24 | 8.15 | 6.98 | 1.38 | 0.83 | 5.90 | 1.99 |
| *cataphract (mốc)* | 0.19 | 0.07 | 1.79 | 2.19 | – | 0.39 | 1.18 | 1.11 |
| *armored_elephant (mốc)* | 0.31 | 0.30 | 4.57 | 5.60 | 2.55 | – | 8.28 | 2.59 |

Đọc bảng:

- **Mọi unit riêng đều có khắc chế** (cột cuối của công cụ): cung riêng thua bộ binh kiếm, hoplite, hoof_lancer;
  ironclad thua hoplite (0.33) và hòa broad_swordsman (0.87); grove_warden và bearkin_brute thua legion, centurion, voi
  giáp. Không cần thêm vào `balance.accept`.
- **Cùng tầm với unit gốc gần nhất:** ironclad ≈ broad_swordsman (hàng gần như trùng, rẻ vàng hơn thì chậm hơn);
  centaur_archer ở giữa chariot_archer và composite_bowman; glade_archer kém composite ~25% với cùng tài nguyên, đổi
  lại không tốn vàng và không cần 2 tech; grove_warden và bearkin_brute ở giữa cataphract và armored_elephant.
- Hiệu suất thô (máu × đòn/giây ÷ tổng giá), để so nhanh:

| unit (đã cộng bonus) | tổng giá | eff | mốc | eff mốc |
| --- | --- | --- | --- | --- |
| glade_archer | 80 | 2.01 | composite_bowman | 2.68 |
| deep_arbalest | 85 | 2.35 | composite_bowman | 2.68 |
| centaur_archer | 92 | 2.54 | chariot_archer / horse_archer | 1.70 / 2.33 |
| ironclad | 70 | 6.48 | broad_swordsman | 8.40 |
| hoof_lancer | 120 | 5.78 | cavalry | 5.33 |
| wolfkin_raider | 60 | 3.21 | axeman | 3.33 |
| bearkin_brute | 110 | 16.00 | legion (tech 2000 tài nguyên) | 27.73 |
| grove_warden | 220 | 17.68 | war_elephant | 28.57 |

- Cảnh báo: `centurion` và `legion` vẫn đứng đầu Iron Age như bản gốc; Elf và Beastfolk mất cả hai, Centaur mất cả
  dòng kiếm và Academy. Đó là cái giá cố ý; giả lập trận (mục 5) sẽ cho biết có quá nặng không.

## 3. Hướng hình ảnh

**Luật repo:** mọi thứ tự làm. Không chép hình, mô hình, tên unit, tên phe hay bảng màu đặc trưng của game nào. Các game
dưới đây chỉ để hiểu quy ước chung của thể loại (tai nhọn, râu dài...), không để bắt chước một thiết kế cụ thể. Tên
trong đề xuất (Glade Archer, Ironclad, Hoof Lancer...) là tên chung chung, cần kiểm lại bằng `/replica-brand` trước khi
phát hành.

### 3.1 Các game khác thể hiện thế nào (tóm tắt quy ước)

| Tộc | AoE2 / AoM | Warcraft III | Heroes of Might & Magic | Total War: Warhammer | Battle for Wesnoth |
| --- | --- | --- | --- | --- | --- |
| Elf | AoE2 không có; mẫu "cung dài" ở các dân tộc đảo. AoM không có elf | Elf đêm: tông tím–lục lam, nhà là cây sống, cung thủ nữ; elf cao: đỏ–vàng | Phe rừng (III, V): elf, người cây, kỳ lân, nhà dựng quanh thân cây | Elf rừng: tông thu (cam, nâu, lục), cây linh; elf cao: trắng–xanh, tháp nhọn | Phe nổi dậy: elf xanh lá–nâu, người cây chậm |
| Dwarf | AoM: thợ người lùn Bắc Âu, giỏi đào vàng | Mũ sắt, râu tết, súng và máy bay cánh quạt, thành trong núi | Có ở phe rừng (III), phe pháo đài (V): rìu, búa, rune | Không có kỵ, chậm, pháo mạnh, giáp nặng, nhà xây trong đá | Mạnh ở núi và hang, chậm ở đồng bằng |
| Nhân mã | AoM: nhân mã cung là thú thần thoại Hy Lạp | Quái trung lập, bộ lạc thảo nguyên | Nhân mã là lính cấp thấp phe rừng | Nhân mã thú dữ trong phe người thú | Không phải phe chính |
| Thú nhân | AoM: đầu chó rừng (Ai Cập), minotaur | Người bò, người gấu, linh cẩu (quái) | Người thằn lằn, linh cẩu ở phe đầm lầy | Người thú sừng dê, người chuột | Người thằn lằn, người cây |

Quy ước chung rút ra: **hình dáng nói tộc trước màu**. Elf = dọc và mảnh; Dwarf = thấp và rộng; nhân mã = ngang và dài;
thú nhân = gù, có tai, đuôi, mõm. Ở cỡ sprite của game (lính ~40–60 px), chỉ hình dáng là đọc được.

### 3.2 Hướng của Bronze Dawn

Giữ phong cách Bronze Age của game: kim loại đồng, vải thô, gỗ, đá; không phép thuật lấp lánh, không phát sáng. Giả
tưởng "mộc", như một dân tộc cổ có thật.

| | Elf | Dwarf | Centaur | Beastfolk |
| --- | --- | --- | --- | --- |
| Hình dáng lính | Cao hơn người ~10%, gầy, tai nhọn, áo choàng dài, cung cao hơn người | Thấp ~80%, rộng ~120%, râu che ngực, mũ đồng kín, khiên tròn to | Thân ngựa + thân người; dài gấp đôi bộ binh; tóc đuôi ngựa, cung ngắn cong | Gù, chân thú, tai và đuôi nhìn rõ; mỗi unit một loài (sói nhỏ nhanh, gấu to) |
| Người dân | Elf dáng mảnh, dụng cụ gỗ | Dwarf thấp, cuốc to | **Satyr chân dê hai chân** (dùng lại khung người dân; nhân mã bốn chân làm 10 động tác thu hoạch là quá nặng) | Cáo hoặc chó, hai chân, dùng lại khung người dân + đầu, tai, đuôi |
| Bảng màu gợi ý | rêu `#4F7A3A`, vỏ bạch dương `#E8E2D0`, lá thu `#C9952E` | đá granit `#6B6A66`, đồng `#B0733A`, than hồng `#D9622B`, đá phiến `#2F3236` | hạt dẻ `#8A5A3A`, trời `#6FA8C9`, ngà `#EFE6D2`, sao vàng `#E3C25B` | đất son `#B5803F`, xương `#E6D9B8`, gỉ đỏ `#9A3B26`, lông nâu `#5B3F2A` |
| Kiến trúc | Sàn gỗ tròn quanh thân cây lớn, mái lá dốc, cầu treo, không tường đá | Thấp, dày, đá khối, cửa vòm chìm vào đất, ống khói tỏa khói, mái đá phẳng | Lều vải và nhà cột mở, sân rộng (nhân mã không vào nhà hẹp), đài quan sát sao | Lều da, nhà dài vách đất mái rơm, cột vật tổ, rào xương |
| `arch` dùng tạm | `asian` (gỗ, mái cong) | `babylonian` (khối lớn, mái phẳng, gạch) | `greek` (cột, sân) | `egyptian` (đất son, đá; ở Thời đồ đá đã có chòi tròn của `stoneage.py`) |
| Màu người chơi đặt ở | băng vải, đuôi tên | dải trên mũ, mặt khiên | khăn vai, chăn trên lưng ngựa | sơn mặt, tua trên giáo |

### 3.3 Đường làm hình: Blender qua `art3d/`

Mọi hình mới dựng bằng code trong `art3d/` (khối cơ bản, render 8 hướng, `lib.pixel_art`, màu người chơi qua
`lib.team_mat()`), như README của `art3d/` mô tả. Việc cần làm:

| Việc | File | Cỡ |
| --- | --- | --- |
| Hình unit theo tộc: khóa `units["villager@elf"]` trong manifest, game lấy hình theo tộc, không có thì dùng hình chung | `art3d/build.py`, manifest, `web/src/game/art.ts` | Mã: nhỏ, ~1 ngày |
| Khung người dân thêm tỉ lệ (cao/gầy, thấp/rộng) và phụ kiện (tai, đuôi, râu) | `villager.py`, `soldiers.py` | vừa, ~3 ngày |
| Nhân mã: ghép thân người vào khung ngựa có sẵn (`soldiers.mounted`) | `soldiers.py` | vừa, ~2 ngày |
| Người cây, thú nhân gấu: khung mới | `soldiers.py` hoặc file mới | vừa, 2–3 ngày mỗi loại |
| Bộ nhà mới cho mỗi tộc (19 nhà × 3 thời đại) | `buildings.py` + `art.ts` | **lớn, 1–2 tuần mỗi tộc**; nên dùng `arch` tạm trước |

## 4. Thêm tộc khác

| Tộc | Bản sắc | Bonus chính | Điểm yếu | Cần bộ máy mới |
| --- | --- | --- | --- | --- |
| **Orc** | Bộ lạc chiến binh, sống để đánh. Rẻ, đông, khỏe, thô | Bộ binh barracks ×0.85 giá, +10% máu | Không đền (tắt `temple`), không tháp đá cao, cung yếu | Không. Toàn dữ liệu |
| **Giant** | Ít người mà to: mỗi lính bằng ba, đi chậm, phá nhà | Lính `pop` 2 nhưng ×2.2 máu và đòn; người dân mang ×2 | Ít quân, thầy tu địch đổi phe một con là mất nhiều; không quân cưỡi | Không (`pop` đã là stat). Hình to: cần khung mới |
| **Lizardfolk** | Đầm lầy và sông; cá và săn; giáo và lao | Cá ×1.4, quân nhanh hơn trên `shallows` | Không ngựa, tháp yếu, lạnh thì chậm (không cần mô phỏng) | Tốc độ theo loại đất: nhỏ–vừa |
| **Undead** | Xác sống không ăn: lính chết đứng dậy | Lính không tốn thức ăn (giá chuyển sang vàng và gỗ), miễn đổi phe | Không hồi máu bằng thầy tu, không nông trại tốt, chậm | Miễn đổi phe đã có (`convert_resist`); "dậy từ xác": vừa |
| **Merfolk / Naga** | Tộc biển: thuyền mạnh, lính lên bờ được | Tàu ×0.75 giá, ×1.3 máu | Trên cạn yếu, không kỵ | Lính đi được cả nước nông và sâu: lớn |
| **Gnome** | Thợ máy nhỏ con: máy công thành, tháp, bẫy | Máy ×0.7 giá, +2 tầm tháp | Lính bộ yếu, ít máu | Không; nhưng trùng ý với Dwarf |
| **Fae** | Tiên nhỏ có cánh, phép lừa | Trinh sát bay, thầy tu mạnh | Mỏng, đắt | Bay (bỏ qua địa hình, va chạm): lớn |
| **Dragonkin** | Người rồng, ít mà mạnh, phun lửa | Unit lửa diện rộng | Rất đắt, ít người dân | Bay + lửa diện rộng: lớn |

**Thứ tự đề xuất.** Bốn tộc ở mục 2 làm đợt 1 (đều dựng được gần hết bằng dữ liệu, chỉ cần `civ` và cờ Fantasy; hình
dùng lại khung người và ngựa). Đợt 2, bốn tộc tiếp theo:

1. **Orc**: không cần bộ máy gì, hình là khung người đổi tỉ lệ; lối chơi "đông và rẻ" chưa tộc nào có.
2. **Giant**: chỉ là dữ liệu (`pop` 2), lối chơi khác hẳn (ít quân). Hình cần khung lớn nhưng một khung dùng cho mọi lính.
3. **Lizardfolk**: dùng bản đồ nước và `shallows` có sẵn; bộ máy chỉ thêm tốc độ theo đất.
4. **Undead**: bản sắc mạnh nhất, nhưng cần "không ăn" và "dậy từ xác": để cuối đợt 2.

Để sau: Merfolk, Fae, Dragonkin (bay hoặc lội nước là đổi cả tìm đường); Gnome (trùng Dwarf).

## 5. Cách đưa vào mà không phá chế độ Rise of Rome

### 5.1 Dữ liệu và thiết lập

| Bước | Chi tiết | Cỡ |
| --- | --- | --- |
| File riêng | `data/fantasy.json` (unit, tech, civ mới, cộng danh sách thêm vào `trains`), gộp vào lúc nạp luật. `rules.json` giữ nguyên số của `empires.dat` để còn so được với bản gốc | nhỏ |
| `civ` trên UnitDef và TechDef | Unit/tech có `civ` chỉ mở cho tộc đó: kiểm trong `world.ts` (chỗ đã kiểm `mods.disabled`: canTrain, visible, research), `civBent`, HUD | nhỏ, ~0.5–1 ngày |
| `fantasy: true` trên CivDef | Tùy chọn ở màn hình bắt đầu "Civilizations: Rise of Rome / Rise of Rome + Fantasy" (mặc định Rise of Rome), như tùy chọn "Farms block the way". Danh sách chọn và chọn ngẫu nhiên trong `game.ts` (chỗ dựng `<select id="civ">` và các chỗ chọn dân tộc cho AI và bạn bè) chỉ lấy từ nhóm được phép | nhỏ, ~1 ngày |
| Online và bản lưu | Gửi tùy chọn cùng các tùy chọn trận khác (như `farmsBlock`); bản lưu ghi lại; bản cũ không có thì là Rise of Rome | nhỏ |
| `civBent` | Unit có `civ` bằng tộc của mình được cộng sàn 0.35, để AI dựng nhà luyện unit riêng | rất nhỏ |
| Team bonus | `team_effects` trên CivDef, áp cho đồng minh trong `Mods.setCiv`; chỉ khi bật Fantasy | nhỏ, ~1 ngày |

Tổng đợt 1 phần bộ máy (không tính tàng hình, hồi máu): ~4–5 ngày. Tùy chọn thêm: hồi máu ~1 ngày, tàng hình trong rừng
2–3 ngày. Hình: chạy song song, lâu hơn nhiều; trong lúc chờ, game vẽ unit riêng bằng hình unit gần nhất (glade_archer
dùng hình composite_bowman...) và nhà bằng `arch` tạm.

### 5.2 Test cần thêm (`web/test/core.test.ts`)

- Mặc định (không bật Fantasy): danh sách dân tộc vẫn đúng 17 (test hiện có `RULES.civs.length` phải đổi thành đếm dân
  tộc không có `fantasy`), không ai luyện được unit có `civ`.
- Bật Fantasy: mỗi tộc luyện được unit riêng của mình và **không** luyện được của tộc khác; tech riêng tương tự.
- Số đúng như tài liệu: Elf `glade_archer` tầm 8; Dwarf `ironclad` giáp 4, tốc độ 0.9; Centaur `centaur_archer` giá
  56f 36g; Beastfolk `wolfkin_raider` luyện 19.2 giây.
- Mỗi tộc mới tắt hơn 10 thứ (như test "each civilization lacks what its tech tree lacks").
- `civBent` của mỗi tộc có ít nhất một building > 0.
- Online: khách nhận được tùy chọn Fantasy; bản lưu cũ nạp ra Rise of Rome.
- Nếu làm hồi máu, tàng hình: test riêng cho từng cái (máu lên khi đứng yên 5 giây, không lên khi đang đánh; địch không
  thấy lính cạnh cây ở 3 ô).

### 5.3 Giả lập và cân bằng

1. `python3 -I replica-skill/replica-game-design/balance.py` trên `rules.json` đã gộp `fantasy.json`: 0 lỗi, mọi unit
   riêng có khắc chế (như mục 2.5).
2. `npm run sim:civ -- 20 hard inland 45` (từ `web/`): kiểm tra AI chơi theo tộc giả tưởng **không** thua nhiều hơn khi
   không chơi theo (số "worse" không vượt "better"). Lưu ý: script này đo "chơi theo dân tộc có giúp không", không đo tỉ
   lệ thắng, và lấy dân tộc từ `RULES.civs` nên cần nhận tham số để gồm tộc Fantasy.
3. Script mới `npm run sim:races` (gợi ý `web/scripts/race-winrate.ts`, dùng `runMatch` như `civ-ai.ts`): mỗi tộc giả
   tưởng đấu với cả 17 dân tộc, ≥ 6 seed mỗi cặp, AI hard, bản đồ inland và một bản đồ có nước. **Đích: tỉ lệ thắng mỗi
   tộc 40–60%**; ngoài khoảng đó thì chỉnh giá unit riêng trước (±10%), rồi đến độ lớn bonus, cuối cùng mới đổi
   `disabled`.
4. Chạy lại cả hai sau mỗi lần chỉnh số; ghi kết quả vào cuối tài liệu này.

### 5.4 Không làm

- Không đổi số của 17 dân tộc gốc để chiều tộc mới.
- Không bật Fantasy làm mặc định.
- Không đưa tên phe, tên unit, hình hay bảng màu của các game ở mục 3 vào game.

## 6. Kết quả đợt 1 (2026-10-14)

Đã làm: trường `civ` cho unit và tech (`Mods` tắt chúng với mọi dân tộc khác), `looks_like` (unit chưa có hình
riêng thì vẽ bằng hình của unit gần nhất: Glade Archer như Improved Bowman, Grove Warden như Phalanx, Ironclad như
Broad Swordsman, Deep Arbalest như Composite Bowman, Centaur Archer như Horse Archer, Hoof Lancer như Cataphract,
Wolfkin như Axeman, Bearkin như Long Swordsman), sàn 0.35 trong `civBent` cho unit riêng, AI luyện Grove Warden ở
Temple (giới hạn 2 chỉ còn áp cho thầy tu), phím luyện riêng (G, D, N, I, W, B, Q), danh sách chọn chia nhóm
"Rise of Rome" / "Fantasy", mô tả dân tộc kể unit và tech riêng. Chưa làm: team bonus, hồi máu, tàng hình.

Giả lập: `npm run sim:races -- 6 hard inland 45` (mỗi tộc đấu 17 dân tộc gốc, 6 seed mỗi cặp, đổi bên; hết giờ tính
nửa trận). Mốc của dân tộc gốc chạy cùng cách: Greek 45%, Egyptian 46%, Shang 64%.

| Tộc | Lần 1 | Chỉnh | Lần cuối |
| --- | --- | --- | --- |
| Elf | 68% | gỗ ×1.2 → ×1.15, hái quả ×1.2 → ×1.1, `glade_archer` 40f 40w → 45f 45w | 60% |
| Dwarf | 50% | không đổi; trên Coastal 28% (Greek 26% trên cùng bản đồ) | 50% |
| Centaur | 71% | tốc độ người dân +0.3 → +0.2, `centaur_archer` 70f 45g → 75f 50g | 58% |
| Beastfolk | 64% | luyện barracks ×0.8 → ×0.85, `wolfkin_raider` 60f → 65f; rồi săn ×1.5 → ×1.4 | 61% |

Mỗi con số là 102 trận, sai số khoảng ±5%. Lần sau: thêm bản đồ có nước cho cả bốn tộc, và mức AI Moderate.

### Hình (Blender, `art3d/races.py`)

Theo ý chủ repo, phong cách anime Nhật hơn châu Âu: đầu hơi to, tóc thành mảng rõ. Elf mặc bikini da gấu (người trưởng thành, không khỏa thân); các tộc khác mặc đủ đồ.

| Tộc | Người dân (`<civ>/villager`, đủ 9 nghề) | Unit riêng |
| --- | --- | --- |
| Elf | cao như người thường, nữ, dáng đầy đặn, mặc bikini da gấu (áo ngực và quần ngắn), khố và băng đô màu người chơi, tóc vàng dài, tai nhọn; săn bằng cung, đánh bằng dao găm. **Mọi lính thường của Elf** (15 loại, khóa `elf/<unit>`) cũng là nữ elf mặc bikini da gấu, giữ mũ, khiên, vũ khí và áo choàng của loại lính đó | Glade Archer: cung cao gần bằng người, áo choàng màu người chơi; Grove Warden: người cây cao 1,6 lần |
| Dwarf | thấp 80%, bè 130%, râu tết hai lọn có khoen đồng, mũi to | Ironclad: mũ kín, giáp sắt, khiên to; Deep Arbalest: nỏ nặng, quay tay nạp dây |
| Centaur | nhân mã bốn chân: thân người mọc ở ngực ngựa, đi nước kiệu; các việc của tay và thân như người dân thường, xẻ thịt thì cúi xuống | Centaur Archer; Hoof Lancer (ngựa xám, giáo dài, phi nước đại) |
| Beastfolk | mặt người, tai và đuôi mèo, cao 110% | Wolfkin Raider: đầu sói xám, hai rìu, cao 125%; Bearkin Brute: đầu gấu nâu, chùy đá, cao 145% |

Khung xương, động tác và cách render là của người dân và lính chung (`villager.Rig`, `soldiers.Soldier`): một
`Look` cho mỗi tộc (màu da, tóc, vải; cao, bè, cỡ đầu; bộ phận riêng), rồi `races.finish` gắn bộ phận và đổi dáng.
`blender -b --factory-startup -P art3d/build.py -- --only elf` (hoặc `dwarf`, `centaur`, `beastfolk`, một khóa như
`elf/villager:axe`, hay `races` cho 8 unit riêng). Bản đầy đủ của cả bốn tộc và 8 unit mất khoảng 2 giờ trên Mac chip M
khi chạy 4 tiến trình cùng lúc. Gallery có mục `fantasy` (`gallery.html?section=fantasy`), có cả góc nghiêng vì nhìn
thẳng từ trước thì thân ngựa của nhân mã bị người che.
