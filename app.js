'use strict'

const { Telegraf } = require('telegraf')
//const Composer = require('telegraf/composer')
const Markup = require('telegraf/markup')
const session = require('telegraf/session')
const commandParts = require('telegraf-command-parts')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const WizardScene = require('telegraf/scenes/wizard')
const { leave } = Stage

const userInfo = require("./middlewares/user-info")
const api = require('sg-node-api')

const greeter = new Scene('greeter')
greeter.enter((ctx) => {
    ctx.reply('Main menu', Markup.keyboard(['/commit','/newgoal', '/mygoals', '/deletegoal']).resize().extra())
})


const commit = new WizardScene('commit',
    async (ctx) => {
        ctx.session.commit = await api.goal().find(ctx, getId(ctx))

    },
    (ctx) => {
        return ctx.wizard.next()
    },
    (ctx) => {
        return ctx.wizard.next()
    },
    async (ctx) => {
        return ctx.scene.leave()
    }
)

const newGoal = new WizardScene('newgoal',
    (ctx) => {
        ctx.reply('Please give a name for your Shared Goal.\nEnglish, meaningful title is preferred, but you are free to choose.', 
            Markup.keyboard(['/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        ctx.session.goalattr = {title: ctx.message.text} // Use regexp for Text without specials from the start
        ctx.reply('Ok. Please enter the short ID for your Goal or use default with the button.',
            Markup.keyboard([ctx.session.goalattr.title.toLowerCase().split(' ').join('_')].concat('/cancel')).resize().extra()) // Transliterate
        return ctx.wizard.next()
    },
    (ctx) => {
        if (/^[a-zA-Z0-9]+$/.test(ctx.message.text)) {
            ctx.reply('Please use short string for code without spaces and special letters')
            return
        }
        ctx.session.goalattr.code = ctx.message.text
        ctx.session.newgoal = api.goal()
        ctx.session.newgoal.set(ctx.session.goalattr)
        ctx.session.newgoal.save(ctx)
        ctx.replyWithMarkdown('Please specify the Contract for your Goal.\nThe most common choice is `1h every day`.\n' +
                              'Other examples are `30m monday, thursday` or `2h 10, 25`',
            Markup.keyboard(['1h every day', '30m monday, thursday', '2h 10, 25'].concat('/cancel')).resize().extra())
        return ctx.wizard.next()
    },
    async (ctx) => {
        const contract = ctx.session.newgoal.get('contract')
        contract.set({goal: ctx.session.newgoal.get('id')}) // Ambiguous line
        const contractData = await contract.validateFormat(ctx, ctx.message.text)
        if (!contractData) {
            ctx.reply('Wrong format for contract', Markup.keyboard(['/cancel']).resize().extra())
            return
        }
        contract.set(contractData)
        contract.save(ctx)
    
        const goalUrl = `${ctx.session.newgoal.get('owner').username}/${ctx.session.newgoal.get('code')}`

        ctx.reply('You goal is created! You can share it with others\n' + 
                  'For editing your goals use /mygoals\nYou already can forward this command to your friends')
        ctx.reply(`/contract ${goalUrl} ${contract.toString()}`, Markup.keyboard([]).extra()) // Remove keyboard?
        return ctx.scene.leave()
    }
)

const deletegoal = new WizardScene('deletegoal',
    async (ctx) => {
        ctx.session.deletegoal = await api.goal().find(ctx, getId(ctx))
        if (!ctx.session.deletegoal) {
            ctx.reply('Goal was not found')
            return ctx.scene.leave()
        }
        ctx.replyWithMarkdown('Please send `I\'m sure!` to delete.', Markup.keyboard(['/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text !== 'I\'m sure!') {
            ctx.reply('Text isn\'t identical. Returned to main menu.')
            return ctx.scene.leave()
        }
        ctx.session.deletegoal.set({archived: true})
        ctx.session.deletegoal.save(ctx)
        ctx.reply('Goal is gone...')
        return ctx.scene.leave()
    }
)

const stage = new Stage()
stage.command('/cancel', leave())

stage.register(greeter, newGoal, commit, deletegoal)
const bot = new Telegraf(process.env.BOT_TOKEN)

bot.use(session())
bot.use(stage.middleware())
bot.use(commandParts())
bot.use(async (ctx, next) => {
    if (!ctx.session.user) {
        await userInfo.getUserInfo(ctx)
    }
    if (!ctx.scene || !ctx.scene.current) {
        ctx.scene.enter('greeter')
    }
    return next()
})

/**
 * /commit sg 90min WhatDone WhatsNext
 */
bot.command('/commit', async (ctx) =>  {
    if (!ctx.state.command.splitArgs[0]) {
        const contracts = await api.contract().findByUser(ctx)
        const buttons = contracts.map((c) => { // .filter((c) => (c.get('today') === true)) - overdue, active and sort duration desc
            return `/commit ${c.get('goal').code} ${c.get('duration')}`
        })
        ctx.reply('Select a contract to commit:', 
            Markup.keyboard(buttons.concat('/cancel')).resize().extra())
    } else {
        ctx.scene.enter('commit')
    }
})

/**
 * /contract Adidas/RunEveryDay 45min everyday
 * /contract bongiozzo/sg 1h everyday
 */
bot.command('/contract', async (ctx) =>  {

})

/**
 * /newgoal RunEveryDay 1h everyday
 * /newgoal MoveToHouse 3h every saturday,sunday
 */
bot.command('/newgoal', async (ctx) =>  {
    if (ctx.state.command.splitArgs[0]) {
        // from command line
    } else {
        ctx.scene.enter('newgoal')
    }
})

/**
 * /mygoals - List my goals
 * Return Goal menu
 */
bot.command('/mygoals', async (ctx) =>  {

})

/**
 * /deletegoal - Delete goal
 * Return Goal menu
 */
bot.command('/deletegoal', async (ctx) =>  {
    if (!ctx.state.command.splitArgs[0]) {
        const goals = await api.goal().findAll(ctx)
        const buttons = goals.map((c) => {
            return `/deletegoal ${c.get('code')}`
        })
        ctx.reply('Choose a goal to delete:', 
            Markup.keyboard(buttons.concat('/cancel')).resize().extra())
    } else {
        ctx.scene.enter('deletegoal')
    }
})

bot.launch()

// Move the logic of this function to sg-node-api
function getId (ctx) {
    let id = ctx.state.command.splitArgs[0]
    const re = new RegExp('^(?<owner>[^/\\s]+)/(?<code>.+)$')
    const sub_matches = id.match(re)
    if (!sub_matches || !sub_matches.groups) {
        id = ctx.session.user.get('username') + '/' + id
    }
    return id
} 
