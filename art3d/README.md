# art3d: sprite render bằng Blender

Hình trong `web/public/assets/art3d/` được dựng 3D bằng code rồi render thành sprite 2D, giống cách các game
chiến thuật cuối thập niên 90 làm. Mọi mô hình đều tự dựng từ khối cơ bản trong các file ở đây: không lấy hình,
mô hình hay ảnh mẫu của game nào. Vì vậy hình được đưa lên repo và GitHub Pages cùng game.

## Chạy

Cần Blender 4.2 trở lên (`brew install --cask blender` trên Mac, `winget install BlenderFoundation.Blender` trên
Windows; trên Windows gọi `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"` thay cho `blender`).
Cycles dùng card đồ họa nếu có: Metal trên Mac, CUDA (rồi OptiX, HIP, oneAPI) trên Windows và Linux; không có
thì chạy bằng CPU, chậm hơn nhưng ra cùng hình.

```
blender -b --factory-startup -P art3d/build.py                         # tất cả
blender -b --factory-startup -P art3d/build.py -- --only villager,house # vài thứ
blender -b --factory-startup -P art3d/build.py -- --only villager --quick
```

`--quick` chỉ render 2 hướng và vài khung hình, để xem nhanh phong cách. Bản đầy đủ của người dân mất vài phút
trên Mac chip M. Kết quả ghi vào `web/public/assets/art3d/` và cập nhật `web/public/assets/manifest.json`
(chỉ các mục vừa render; mục khác giữ nguyên).

Script in `WARNING ... cut off` khi hình hoặc bóng chạm mép khung: nới khung (`size`, `VILLAGER_FRAME`) hoặc
dời tâm (`center`) trong code.

## Các file

| File | Nội dung |
| --- | --- |
| `lib.py` | Cảnh, camera isometric 2:1, nắng, vật liệu, render và đóng sheet |
| `villager.py` | Người dân: khung xương bằng empty; dụng cụ (rìu, cuốc, búa, giỏ quả, dao, cuốc ruộng, giáo, cần câu); các động tác đứng, đi, chặt cây, đào mỏ, đóng búa, hái quả, ngồi xẻ thịt, cày ruộng, phóng giáo, đứng câu cá (giỏ cá đặt bên cạnh, dây câu và phao, giật cần khi cá cắn) |
| `animals.py` | Thú: linh dương (gặm cỏ, chạy) và xác của nó |
| `models.py` | Cây, bụi quả, mỏ vàng, mỏ đá, vách đá |
| `relics.py` | Ruins (vòng đá cổ có xà ngang và phiến đá tế) và Artifact (rương vàng trên hai đòn khiêng, nhún nhẹ khi đi); mỗi thứ hai hình: lúc chưa ai giữ (không có màu người chơi) và lúc có người giữ (`ruins:held`, `artifact:held`: cờ hoặc tấm vải màu người giữ) |
| `buildings.py` | Mọi công trình theo từng thời đại (Tool, Bronze, Iron) |
| `stoneage.py` | Công trình Thời đồ đá: chòi tròn và nhà dài vách đất trên móng đá, mái rơm nhiều lớp có dây buộc, sân đất và đồ vật quanh nhà (củi, chum, giỏ, giá phơi da, hàng rào, cột cờ) |
| `races.py` | Các tộc giả tưởng: dáng người, màu, bộ phận riêng của Elf, Dwarf, Centaur, Beastfolk trên khung người dân chung; nhân mã (thân người trên ngựa không đầu); người cây; 8 unit riêng (`replica/game/fantasy-races.md`) |
| `race_buildings.py` | Công trình của 4 tộc giả tưởng: mỗi tộc một bộ khối dựng (gỗ sống và lá; đá đào vào núi; lều vải và nhà cột; lều da, nhà dài, cột vật tổ), cùng bố cục cho mọi tộc; Town Center, Temple, Wonder riêng của từng tộc |
| `soldiers.py`, `machines.py` | Lính bộ, cung thủ, thầy tu, quân cưỡi; máy công thành và tàu |
| `terrain.py` | Ô đất: cỏ, đất, cát, nước |
| `build.py` | Danh sách cái cần render, kích thước khung, điểm neo, ghi manifest |

## Quy ước

- **Tọa độ:** X của Blender là trục x của bản đồ, -Y là trục y, Z hướng lên; 1 đơn vị là 1 ô. Camera nhìn theo
  hướng (-1, -1) của bản đồ, chếch xuống 30°, nên mỗi ô là hình thoi 2:1 như trong game.
- **Kiểu pixel:** render gấp đôi kích thước game (ô 128 × 64), rồi `lib.pixel_art` thu về đúng kích thước game:
  viền cứng (không bán trong suốt), viền tối 1 px quanh hình, ít bậc màu hơn, bóng một mảng tối phẳng. Game vẽ
  hình từ file với điểm ảnh sắc nét (nearest), nên phóng to vẫn rõ từng điểm như sprite của game cuối thập niên 90.
  Chỉnh độ đậm viền, số bậc màu, độ bão hòa ở `OUTLINE`, `LEVELS`, `SATURATE`.
- **Hướng:** 8 hướng, theo chiều kim đồng hồ từ hướng nhìn ra người xem (S, SW, W, NW, N, NE, E, SE). Mô hình
  dựng quay mặt về -Y.
- **Màu người chơi:** vật liệu tạo bằng `lib.team_mat()`. Mỗi khung render hai lần: lần thứ hai chỉ để biết
  vùng nào là màu người chơi. Vùng đó được tô thành các sắc độ tím #FF00FF, và game đổi sang màu của từng người.
- **Điểm neo:** người dân và thú neo ở chân. Công trình neo ở góc dưới của hình thoi. Cây neo ở gốc, đặt vào
  giữa ô.
- **Vách đá:** mỗi ô vách đá một hình, chọn theo bốn ô bên cạnh có phải vách đá không (khóa `cliffs` trong
  manifest, số 0–15: 1 là x - 1, 2 là x + 1, 4 là y - 1, 8 là y + 1). Đá vươn sang hướng có vách đá bên
  cạnh, nên một dãy ô thành một sống núi liền.
- **Bóng:** render sẵn vào hình (game không tự vẽ bóng). Nắng chiếu từ trên bên trái, bóng đổ sang phải.
- **Màu:** ghi màu đúng như nhìn trên màn hình (sRGB); `lib.mat` tự chuyển sang màu tuyến tính cho Blender.

## So với hình của bản gốc

`compare.py` đặt từng hình của Bronze Dawn cạnh hình của AoE gốc cùng loại, rồi chấm điểm trên 100 cho mức gần
bản gốc. Công trình được so theo kiến trúc và thời đại, unit theo khung đứng yên quay ra người xem, tài nguyên
theo hình đầu tiên. Cần một bản sao repo riêng tư `BronzeDawn-aoe-data`, và Pillow, numpy (chạy bằng python3
thường, không chạy trong Blender).

```bash
python3 art3d/compare.py                                   # bản gốc ở web/assets-local/
python3 art3d/compare.py --aoe ../BronzeDawn-aoe-data      # hoặc chỉ đường tới nó
python3 art3d/compare.py --only house,clubman,tree         # vài thứ
open web/art-compare/index.html
```

Tám thước đo, mỗi thước 100 là như bản gốc, gấp đôi hay bằng nửa là 35:

- **Cỡ:** diện tích phần hình, không tính bóng đổ.
- **Chi tiết:** độ gắt giữa các điểm ảnh liền nhau bên trong hình.
- **Tương phản:** độ chênh sáng tối trong hình.
- **Độ sáng, Độ đậm màu.**
- **Bảng màu:** phần màu trùng với bản gốc.
- **Màu phe:** phần trăm hình tô #FF00FF.
- **Viền tối:** độ tối ở mép hình.

Trang báo cáo xếp hình kém nhất lên đầu, hiện hai hình trên nền cỏ và ghi cụ thể hình của ta lệch thế nào
(ví dụ "ít chi tiết hơn 2.0×"). `scores.json` chứa cùng các số đó để so trước và sau mỗi lần chỉnh.

Trang báo cáo **chứa hình của bản gốc**. Nó nằm ở `web/art-compare/`, thư mục này đã nằm trong .gitignore.
Không đăng, không chia sẻ trang này.
