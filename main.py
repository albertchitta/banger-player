import discord
from discord.ext import commands
import os, asyncio
from dotenv import load_dotenv

# Load token from .env file
load_dotenv()

# Import all of the cogs
from help_cog import help_cog
from music_cog import music_cog

intents = discord.Intents.all()
bot = commands.Bot(command_prefix='!!', intents=intents)

# Remove the default help command so that we can write our own
bot.remove_command('help')

async def main():
    async with bot:
        await bot.add_cog(help_cog(bot))
        await bot.add_cog(music_cog(bot))
        await bot.start(os.getenv("TOKEN"))

asyncio.run(main())
