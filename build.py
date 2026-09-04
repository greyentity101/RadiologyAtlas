import PyInstaller.__main__
import os
import shutil
import pathlib

if __name__ == '__main__':
    project_dir = pathlib.Path(__file__).resolve().parent
    app_script = project_dir / 'app.py'
    assets_dir = project_dir / 'assets'
    version_file = project_dir / 'version_info.py'
    icon_file = assets_dir / 'atlas_icon.ico'
    dist_exe = project_dir / 'dist' / 'RadiologyAtlas.exe'
    desktop_exe = pathlib.Path.home() / 'Desktop' / 'RadiologyAtlas.exe'

    # 1) Build frontend hybrid SPA first
    frontend_dir = project_dir / "frontend"
    import subprocess
    if (frontend_dir / "package.json").exists():
        print(f"Building frontend SPA {frontend_dir} ...")
        result = subprocess.run("npm run build", cwd=str(frontend_dir), shell=True)
        frontend_dist = frontend_dir / "dist"
        if not (frontend_dist / "index.html").exists():
            print("WARN: frontend/dist/index.html not found after vite build — frontend may have failed")
        else:
            size_mb = sum(f.stat().st_size for f in frontend_dist.rglob('*') if f.is_file())/1024/1024
            print(f"Frontend built: {frontend_dist} ({size_mb:.1f} MB)")
    else:
        print(f"WARN: frontend not found at {frontend_dir}")

    print(f"Building Radiology Atlas v1.3.0 from {app_script}")

    frontend_dist = frontend_dir / "dist"
    add_data_args = [f"{assets_dir};assets"]
    if frontend_dist.exists() and (frontend_dist / "index.html").exists():
        add_data_args.append(f"{frontend_dist};frontend/dist")
    print(f"Bundling: {add_data_args}")

    args = [
        str(app_script),
        '--name=RadiologyAtlas',
        '--noconsole',
        '--windowed',
        '--onefile',
        '--noconfirm',
        f'--version-file={version_file}',
        f'--distpath={project_dir / "dist"}',
        f'--workpath={project_dir / "build"}',
        f'--specpath={project_dir}',
        '--clean',
        '--optimize=1',
    ]
    for a in add_data_args:
        args.append(f'--add-data={a}')
    if icon_file.exists():
        args.append(f'--icon={icon_file}')
    else:
        print(f"WARN: icon not found {icon_file}")

    # Hidden imports for pywebview edgechromium backend
    # (usually auto-detected, but explicit helps)
    args += [
        '--hidden-import=clr',
        '--hidden-import=webview.platforms.edgechromium',
    ]

    PyInstaller.__main__.run(args)

    if dist_exe.exists():
        size_mb = dist_exe.stat().st_size / (1024*1024)
        print(f"\nBuild complete! dist exe {size_mb:.1f} MB at {dist_exe}")
        # auto-copy to Desktop
        try:
            shutil.copy2(dist_exe, desktop_exe)
            print(f"Copied to Desktop: {desktop_exe} ({desktop_exe.stat().st_size / (1024*1024):.1f} MB)")
        except Exception as e:
            print(f"Desktop copy failed: {e}")
        # also copy spec for reference
        spec_src = project_dir / 'RadiologyAtlas.spec'
        spec_dst = pathlib.Path(r"C:\Users\jaat\Documents\Default Project\RadiologyAtlas.spec")
        try:
            if spec_src.exists():
                # patch spec to use relative/portable pathex if needed
                shutil.copy2(spec_src, spec_dst)
                print(f"Spec synced to {spec_dst}")
        except Exception as e:
            print(f"Spec sync failed: {e}")
    else:
        print("ERROR: dist exe not found after build!")
        exit(1)
