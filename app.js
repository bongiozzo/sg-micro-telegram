'use strict'

const Telegraf = require('telegraf')
const session = require('telegraf/session')
const commandParts = require('telegraf-command-parts')
//const logger = __importDefault(require("./util/logger"))
const req = require("./util/req")
const userInfo = require("./middlewares/user-info")


const bot = new Telegraf(process.env.BOT_TOKEN)

bot.use(session())
bot.use(commandParts())
bot.use(userInfo.getUserInfo)

bot.start((ctx) => ctx.reply('Welcome to Shared Goals!'))
bot.help((ctx) => ctx.reply('Please check https://sharedgoals.net'))

// /newgoal RunEveryDay 1h everyday
// /newgoal MoveToHouse 3h every saturday,sunday
bot.command('/newgoal', async (ctx) =>  {
    res = await req.make('newgoal', 
                        ctx.session.userInfo.userId,
                        ctx.state.command.splitArgs[0],
                        ctx.state.command.splitArgs[1],
                        ctx.state.command.splitArgs.slice(2).join(" "))
    ctx.reply(res)
})

// /contract Adidas/RunEveryDay 45min everyday
// /contract bongiozzo/sg 1h everyday
bot.command('/contract', async (ctx) =>  {
    res = await req.make('contract', 
                        ctx.session.userInfo.userId,
                        ctx.state.command.splitArgs[0],
                        ctx.state.command.splitArgs[1],
                        ctx.state.command.splitArgs.slice(2).join(" "))
    ctx.reply(res)
})

// /commit sg 90min WhatDone WhatsNext
bot.command('/commit', async (ctx) =>  {
    res = await req.make('commit', 
                        ctx.session.userInfo.userId,
                        ctx.state.command.splitArgs[0],
                        ctx.state.command.splitArgs[1],
                        ctx.state.command.splitArgs.regexp(1), // Replace with Stage/Scene and additional question
                        ctx.state.command.splitArgs.regexp(2))
    ctx.reply(res)
})

bot.launch()