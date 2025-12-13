import discord
from discord.ext import commands
import os, asyncio, logging, signal, sys
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load token from .env file
load_dotenv()

# Import all of the cogs
from help_cog import help_cog
from music_cog import music_cog

intents = discord.Intents.all()
bot = commands.Bot(command_prefix='!!', intents=intents)

# Remove the default help command so that we can write our own
bot.remove_command('help')

@bot.event
async def on_ready():
    logger.info(f"Bot logged in as {bot.user}")

@bot.event
async def on_message(message):
    logger.info(f"Message from {message.author}: {message.content}")
    await bot.process_commands(message)

async def main():
    async with bot:
        await bot.add_cog(help_cog(bot))
        await bot.add_cog(music_cog(bot))
        
        # Handle graceful shutdown
        loop = asyncio.get_event_loop()
        
        def handle_signal(signum, frame):
            logger.info("Shutdown signal received, closing bot...")
            asyncio.create_task(bot.close())
        
        loop.add_signal_handler(signal.SIGTERM, handle_signal, signal.SIGTERM, None)
        loop.add_signal_handler(signal.SIGINT, handle_signal, signal.SIGINT, None)
        
        try:
            await bot.start(os.getenv("TOKEN"))
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received")
        finally:
            await bot.close()
            logger.info("Bot closed")
            sys.exit(0)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        sys.exit(0)
