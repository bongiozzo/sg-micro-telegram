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
    ctx.reply('Main menu', Markup.keyboard(['/commit', '/contract', '/newgoal', '/mygoals', '/deletegoal']).resize().extra())
})

/**
 * Commit scene
 */
const commit = new WizardScene('commit',
    async (ctx) => {
        if (!findGoalFromArg(ctx)) return ctx.scene.leave()     
        ctx.session.commit = api.commit()
        ctx.session.commitattr = { contract: ctx.session.currentgoal.get('contract').id }
        let buttons = [ ctx.session.currentgoal.get('contract').duration + 'm' ]
        if (ctx.state.command.splitArgs[1] && ctx.session.commit.validateDuration(ctx.state.command.splitArgs[1])) {
            buttons.unshift(ctx.state.command.splitArgs[1]) 
            buttons = [...new Set(buttons)] // check unique
        }
        ctx.reply('What is the duration of your current commit in minutes or hours (1h)? Specify or just press the button',
            Markup.keyboard(buttons.concat('/cancel')).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.session.commit.validateDuration(ctx.message.text)) {
            ctx.session.commitattr.duration = ctx.message.text
        }
        ctx.reply('What was done?',
            Markup.keyboard(['/skip','/cancel']).resize().extra())
        if (ctx.session.currentgoal.get('contract').whats_next) {
            ctx.reply('You can choose from your What is next? plans:\n' + ctx.session.currentgoal.get('contract').whats_next)
        }
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text && ctx.message.text !== '/skip' ) {
            ctx.session.commitattr.whats_done = ctx.message.text
        }
        ctx.reply('What\'s next?',
            Markup.keyboard(['/skip','/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text && ctx.message.text !== '/skip' ) {
            ctx.session.commitattr.whats_next = ctx.message.text
        }
        ctx.reply('Your commit:\n' + 
            `Goal: ${ctx.session.currentgoal.get('owner').username}/${ctx.session.currentgoal.get('code')}\n` + // replace with universtal id method
            `Duration: ${ctx.session.commitattr.duration}\n` +
            ctx.session.commitattr.whats_done ? `What was done: ${ctx.session.commitattr.whats_done}\n` : '' +
            ctx.session.commitattr.whats_next ? `What is next: ${ctx.session.commitattr.whats_next}\n` : '' +
            '\nFinish?',
            Markup.keyboard(['/finish','/cancel']).resize().extra()) // consider button with full text of the command instead /finish
        return ctx.wizard.next()
    },
    async (ctx) => {
        if (ctx.message.text !== '/finish') {
            ctx.reply('Ok... Leaving!')
            return ctx.scene.leave()
        }
        ctx.session.commit.set(ctx.session.commitattr)
        ctx.session.commit.save()
        ctx.reply('Commit is committed :)')
        return ctx.scene.leave()
    }
)

/**
 * Contract scene
 */
const contract = new WizardScene('contract',
    async (ctx) => {
        if (!findGoalFromArg(ctx)) return ctx.scene.leave()     
        ctx.session.contract = api.contract()
        ctx.session.commitattr = { contract: ctx.session.currentgoal.get('contract').id }
        let buttons = [ ctx.session.currentgoal.get('contract').duration + 'm' ]
        if (ctx.state.command.splitArgs[1] && ctx.session.commit.validateDuration(ctx.state.command.splitArgs[1])) {
            buttons.unshift(ctx.state.command.splitArgs[1]) 
            buttons = [...new Set(buttons)] // check unique
        }
        ctx.reply('What is the duration of your current commit in minutes or hours (1h)? Specify or just press the button',
            Markup.keyboard(buttons.concat('/cancel')).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.session.commit.validateDuration(ctx.message.text)) {
            ctx.session.commitattr.duration = ctx.message.text
        }
        ctx.reply('What was done?',
            Markup.keyboard(['/skip','/cancel']).resize().extra())
        if (ctx.session.currentgoal.get('contract').whats_next) {
            ctx.reply('You can choose from your What is next? plans:\n' + ctx.session.currentgoal.get('contract').whats_next)
        }
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text && ctx.message.text !== '/skip' ) {
            ctx.session.commitattr.whats_done = ctx.message.text
        }
        ctx.reply('What\'s next?',
            Markup.keyboard(['/skip','/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text && ctx.message.text !== '/skip' ) {
            ctx.session.commitattr.whats_next = ctx.message.text
        }
        ctx.reply('Your commit:\n' + 
            `Goal: ${ctx.session.currentgoal.get('owner').username}/${ctx.session.currentgoal.get('code')}\n` + // replace with universtal id method
            `Duration: ${ctx.session.commitattr.duration}\n` +
            ctx.session.commitattr.whats_done ? `What was done: ${ctx.session.commitattr.whats_done}\n` : '' +
            ctx.session.commitattr.whats_next ? `What is next: ${ctx.session.commitattr.whats_next}\n` : '' +
            '\nFinish?',
            Markup.keyboard(['/finish','/cancel']).resize().extra()) // consider button with full text of the command instead /finish
        return ctx.wizard.next()
    },
    async (ctx) => {
        if (ctx.message.text !== '/finish') {
            ctx.reply('Ok... Leaving!')
            return ctx.scene.leave()
        }
        ctx.session.commit.set(ctx.session.commitattr)
        ctx.session.commit.save()
        ctx.reply('Commit is committed!')
        return ctx.scene.leave()
    }
)

/**
 * New goal scene
 */
const newGoal = new WizardScene('newgoal',
    (ctx) => {
        ctx.reply('Please give a name for your Shared Goal.\nEnglish, meaningful title is preferred, but you are free to choose.', 
            Markup.keyboard(['/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        ctx.session.goalattr = {title: ctx.message.text} // Use regexp for Text without specials from the start
        ctx.reply('Ok. Please enter the short ID (Code) for your Goal or use default with the button.',
            Markup.keyboard([ctx.session.goalattr.title.toLowerCase().split(' ').join('_')].concat('/cancel')).resize().extra()) // Transliterate
        return ctx.wizard.next()
    },
    (ctx) => {
        if (!/^[a-zA-Z0-9]+$/.test(ctx.message.text)) {
            ctx.reply('Please use short string for ID (Code) without spaces and special letters')
            return
        }
        ctx.session.goalattr.code = ctx.message.text
        ctx.session.currentgoal = api.goal()
        ctx.session.currentgoal.set(ctx.session.goalattr)
        ctx.replyWithMarkdown('Please specify the Contract for your Goal.\nThe most common choice is `1h every day`.\n' +
                              'Other examples are `30m monday, thursday` or `2h 10, 25`',
            Markup.keyboard(['1h every day', '30m monday, thursday', '2h 10, 25'].concat('/cancel')).resize().extra())
        return ctx.wizard.next()
    },
    async (ctx) => {
        const contract = ctx.session.newgoal.get('contract')
        contract.set({goal: ctx.session.currentgoal.get('id')}) // Ambiguous line
        const contractData = await contract.validateFormat(ctx, ctx.message.text)
        if (!contractData) {
            ctx.reply('Wrong format for contract', Markup.keyboard(['/cancel']).resize().extra())
            return
        }
        contract.set(contractData)
        ctx.session.currentgoal.save(ctx)
        contract.save(ctx)
    
        const goalUrl = `${ctx.session.currentgoal.get('owner').username}/${ctx.session.currentgoal.get('code')}`

        ctx.reply('You goal is created! You can share it with others\n' + 
                  'For editing your goals use /mygoals\nYou already can forward this command to your friends')
        ctx.reply(`/contract ${goalUrl} ${contract.toString()}`, Markup.keyboard([]).extra()) // Remove keyboard?
        return ctx.scene.leave()
    }
)

/**
 * Delete goal scene
 */
const deleteGoal = new WizardScene('deletegoal',
    async (ctx) => {
        if (!findGoalFromArg(ctx)) return ctx.scene.leave()     
        ctx.replyWithMarkdown('Please send `I\'m sure!` to delete.', Markup.keyboard(['/cancel']).resize().extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        if (ctx.message.text !== 'I\'m sure!') {
            ctx.reply('Text isn\'t identical. Returned to main menu.')
            return ctx.scene.leave()
        }
        ctx.session.currentgoal.set({archived: true}) // replace with Delete goal
        ctx.session.currentgoal.save(ctx)
        ctx.reply('Goal is gone...')
        return ctx.scene.leave()
    }
)

const stage = new Stage()
stage.command('/cancel', leave())

stage.register(greeter, contract, newGoal, commit, deleteGoal)
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
    ctx.scene.enter('contract')
    if (ctx.state.command.splitArgs[0]) {
        if (!findGoalFromArg(ctx)) return ctx.scene.leave()     
        ctx.wizard.next()
    }
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
function getIdFromArg (ctx) {
    let id = ctx.state.command.splitArgs[0]
    const re = new RegExp('^(?<owner>[^/\\s]+)/(?<code>.+)$')
    const sub_matches = id.match(re)
    if (!sub_matches || !sub_matches.groups) {
        id = ctx.session.user.get('username') + '/' + id
    }
    return id
} 

async function findGoalFromArg (ctx) {
    ctx.session.currentgoal = await api.goal().find(ctx, getIdFromArg(ctx))
    if (!ctx.session.currentgoal) {
        ctx.reply('Goal was not found')
    }
    return ctx.session.currentgoal
}
