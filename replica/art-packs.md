# Gói hình (art pack): tự thay hình và tiếng của Bronze Dawn

Một gói hình là **một thư mục có `manifest.json`** cùng các file PNG và âm thanh nó nhắc tới. Nạp gói ở
**menu chính → Art Packs → Add a folder** (hoặc **Add a zip**), rồi bấm **Reload to apply**.

- Gói chỉ nằm trong trình duyệt của bạn (IndexedDB) và trên ổ đĩa của bạn. Game không gửi nó đi đâu cả.
- Gói thay **từng phần**: thứ gì gói không nhắc tới thì game giữ hình hoặc tiếng của nó. Gói chỉ đổi một con
  voi là được, không cần làm cả bộ.
- Nhiều gói cùng bật được. Gói thêm vào sau đè lên gói trước. Màn hình Art Packs cho bật, tắt, xóa từng gói.
- Muốn chia sẻ thì nén thư mục thành zip rồi gửi. Người nhận dùng **Add a zip**.

## Ví dụ: voi chiến thành khủng long

`web/examples/dino-pack/` là một gói mẫu (vẽ bằng `scripts/make-example-pack.py`):

```
dino-pack/
  manifest.json
  war_dinosaur.png
```

```json
{
  "name": "War dinosaurs (example)",
  "units": {
    "war_elephant": {
      "file": "war_dinosaur.png", "frame": [72, 60], "anchor": [36, 56], "directions": 5,
      "anims": { "idle":   { "row": 0,  "frames": 1 },
                 "walk":   { "row": 5,  "frames": 4, "fps": 8 },
                 "attack": { "row": 10, "frames": 3, "fps": 6 } }
    },
    "armored_elephant": { "...": "cùng như trên" }
  },
  "credits": [{ "what": "War dinosaur", "author": "Bronze Dawn example pack", "license": "CC0" }]
}
```

Thử: menu chính → Art Packs → Add a folder → chọn `web/examples/dino-pack` → Reload. Lên Iron Age và
luyện voi chiến ở Stable: ra khủng long.

## Cách vẽ một sprite sheet

- **Khung hình:** mọi khung cùng cỡ (`frame: [rộng, cao]`), xếp thành lưới. Mỗi cột là một khung hình của
  hoạt ảnh, mỗi hàng là một hướng.
- **Hướng:** theo chiều kim đồng hồ, bắt đầu từ hướng nhìn ra người chơi: S, SW, W, NW, N, NE, E, SE.
  `directions: 5` thì chỉ vẽ 5 hàng đầu (S đến N); game lật ngang để có NE, E, SE.
- **Hoạt ảnh:** `row` là hàng của hướng S; các hướng sau nằm ở các hàng ngay dưới. Có `idle`, `walk`,
  `work` (người dân làm việc), `attack`. Thiếu hoạt ảnh nào thì game dùng hoạt ảnh gần nhất (thiếu `walk`
  thì dùng `idle`).
- **Điểm neo:** `anchor: [x, y]` là chân của đơn vị trong một khung, tính theo điểm ảnh. Với công trình,
  mặc định là **đỉnh dưới** của hình thoi các ô nó chiếm. Nếu hình của bạn neo ở **tâm** hình thoi (như hình
  trích từ game gốc), thêm `"anchorAt": "center"` vào cạnh `anchor`, nếu không công trình sẽ lệch xuống nửa ô.
- **Màu người chơi:** vùng nào cần đổi màu theo phe (áo, yên, cờ) thì tô bằng các sắc độ của **#FF00FF**.
  Game thay bằng màu của từng người chơi, giữ nguyên sáng tối.
- **Tỉ lệ:** ô đất là hình thoi 64 × 32. Muốn vẽ to rồi thu nhỏ thì thêm `"scale": 0.5`.

## Thay được những gì

Danh sách đầy đủ và kích thước nằm trong `replica/assets-needed.md`, mục 9:

| Khóa trong manifest | Thay gì | Theo |
|---|---|---|
| `units` | đơn vị và thú | id của đơn vị (`war_elephant`, `villager`, `villager:axe`...); Ruins và Artifact có người giữ thì dùng `ruins:held`, `artifact:held` nếu có, không thì `ruins`, `artifact` |
| `buildings` | công trình | id, rồi kiểu kiến trúc (`greek`, `egyptian`...) và thời đại |
| `construction` | công trường lúc đang xây, nhiều hình nối nhau theo tiến độ | id của công trình |
| `resources` | cây, mỏ, bụi dâu, cá | id |
| `terrain` | ô đất | `grass`, `dirt`, `sand`, `water` |
| `cliffs` | vách đá, mỗi ô một hình | số 0–15: ô bên cạnh nào cũng là vách đá (1 x-1, 2 x+1, 4 y-1, 8 y+1) |
| `icons`, `resourceIcons`, `cursors` | nút, biểu tượng tài nguyên, con trỏ | id |
| `sfx`, `music` | tiếng, nhạc | tên tiếng (`chop`, `sword`, `voice-villager`...) |
| `maps` | bản đồ ngẫu nhiên thêm vào ô chọn Map | danh sách `RandomMapSpec` (`web/src/core/rmspec.ts`) |

Danh sách id của đơn vị, công trình và công nghệ nằm trong `data/rules.json`.

### Bản đồ (`maps`)

Mỗi bản đồ là một bộ số, không có file ảnh: nền là biển hay đất, đất chiếm bao nhiêu phần trăm, lề ở bốn
cạnh, mỗi người một đảo (`apart`), đất liền nhau (`joined`) hay chung một vùng (`shared`), các vùng cát và
rừng, rồi từng thứ đặt lên bản đồ (mỏ, bụi dâu, thú, cá) gần mỗi người hay rải khắp nơi. Game dựng bản
đồ từ bộ số đó bằng seed của trận, nên cùng seed ra cùng bản đồ, kể cả khi chơi online (bộ số được gửi
kèm cài đặt trận cho mọi máy).

Bản đồ của pack hiện trong ô chọn Map với chữ "(art pack)" phía sau. Tắt pack thì game quay về bản đồ
của chính nó.

Có bản gốc của game trên máy thì `npm run import-aoe` tự ghi `maps` từ dữ liệu bản đồ của game vào
`assets-local/manifest.json`. Với manifest đã nhập từ trước:

```
npm run aoe-maps -- assets-local/aoe-data/empires-ror.json assets-local/aoe-data/strings.json assets-local/manifest.json
```

Cũng như ảnh và tiếng nhập từ game, các bản đồ này chỉ nằm trên máy bạn hoặc trong pack của bạn, không
đưa vào repo hay bản deploy.

## Về bản quyền

Gói bạn tự vẽ, hay lấy từ nguồn có giấy phép (CC0, CC-BY kèm ghi công), thì chia sẻ thoải mái. Hình và tiếng
lấy từ một game khác (kể cả bản bạn đã mua) chỉ dùng trên máy của bạn: đừng gửi cho người khác hay đăng
lên mạng. Gói chỉ nằm trong trình duyệt của bạn, nên làm như vậy không phát tán gì cả.
