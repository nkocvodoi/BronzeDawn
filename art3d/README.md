# art3d: sprite render bằng Blender

Hình trong `web/public/assets/art3d/` được dựng 3D bằng code rồi render thành sprite 2D, giống cách các game
chiến thuật cuối thập niên 90 làm. Mọi mô hình đều tự dựng từ khối cơ bản trong các file ở đây: không lấy hình,
mô hình hay ảnh mẫu của game nào. Vì vậy hình được đưa lên repo và GitHub Pages cùng game.

## Chạy

Cần Blender 4.2 trở lên (`brew install --cask blender` trên Mac).

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
| `villager.py` | Người dân: khung xương bằng empty; dụng cụ (rìu, cuốc, búa, giỏ quả, dao); các động tác đứng, đi, chặt cây, đào mỏ, đóng búa, hái quả, ngồi xẻ thịt |
| `animals.py` | Thú: linh dương (gặm cỏ, chạy) và xác của nó |
| `models.py` | Công trình (Town Center, nhà Thời đồ đá), cây, bụi quả, mỏ vàng, mỏ đá, vách đá |
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
