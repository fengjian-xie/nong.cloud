"""Deploy the authorized work.nong.cloud frontend demonstration only.

One selected demo account can switch its fixed, bound identities without
logging in again. This static site does not provide real authentication.
Shared installer rejects existing ownership and preserves all other sites.
"""
from pathlib import Path
import deploy_cloud_farm as installer


def main():
    installer.DOMAIN = 'work.nong.cloud'
    installer.BASE = Path('/var/www/xiangqiao-work')
    installer.CONFIG = Path('/etc/nginx/conf.d/work.nong.cloud.conf')
    installer.BACKUPS = Path('/var/backups/xiangqiao-work')
    installer.main()


if __name__ == '__main__':
    main()
