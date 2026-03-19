import os
import math
import urllib.request
import time
import ssl

MIN_ZOOM = 10
MAX_ZOOM = 15

LOCATIONS = {
    "manipal": [13.25, 13.45, 74.70, 74.90],
    "spaceport": [32.89, 33.09, -107.07, -106.87]
}

# NEW: Dictionary containing both Dark and Light tile URLs
THEMES = {
    "dark": "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    "light": "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://carto.com/'
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

# NEW: Added theme_name and tile_url parameters
def download_region(name, bounds, theme_name, tile_url):
    print(f"\n🚀 Starting download for: {name.upper()} ({theme_name.upper()})")
    min_lat, max_lat, min_lon, max_lon = bounds
    total_downloaded = 0

    for z in range(MIN_ZOOM, MAX_ZOOM + 1):
        x_min, y_max = deg2num(min_lat, min_lon, z)
        x_max, y_min = deg2num(max_lat, max_lon, z)

        x_start, x_end = min(x_min, x_max), max(x_min, x_max)
        y_start, y_end = min(y_min, y_max), max(y_min, y_max)

        for x in range(x_start, x_end + 1):
            for y in range(y_start, y_end + 1):
                # NEW: Added {theme_name} to the folder path
                folder_path = f"public/tiles/{name}/{theme_name}/{z}/{x}"
                os.makedirs(folder_path, exist_ok=True)
                
                file_path = f"{folder_path}/{y}.png"
                
                if os.path.exists(file_path):
                    continue

                url = tile_url.format(z=z, x=x, y=y)
                req = urllib.request.Request(url, headers=HEADERS)
                
                try:
                    with urllib.request.urlopen(req, context=ctx) as response, open(file_path, 'wb') as out_file:
                        out_file.write(response.read())
                        total_downloaded += 1
                        print(f"Downloaded: {name} ({theme_name}) / Z:{z} X:{x} Y:{y}")
                    
                    time.sleep(0.15)
                except urllib.error.HTTPError as e:
                    print(f"❌ Server Error {e.code} for {url}")
                except Exception as e:
                    print(f"❌ Local Error: {e} for {url}")

    print(f"✅ Finished {name.upper()} ({theme_name.upper()})! Downloaded {total_downloaded} new tiles.")

if __name__ == "__main__":
    for location, coordinates in LOCATIONS.items():
        # Iterate over both themes for each location
        for theme_name, url_template in THEMES.items():
            download_region(location, coordinates, theme_name, url_template)