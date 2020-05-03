"use strict";

require('dotenv').config()

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod }
}

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Saving data to the session
 * @param ctx - telegram context
 * @param field - field to store in
 * @param data - data to store
 */
function saveToSession(ctx, field, data) {
    if (process.env.LOG == 'on') console.log(ctx, 'Saving %s to session', field)
    ctx.session[field] = data
}

exports.saveToSession = saveToSession

/**
 * Removing data from the session
 * @param ctx - telegram context
 * @param field - field to delete
 */
function deleteFromSession(ctx, field) {
    if (process.env.LOG == 'on') console.log(ctx, 'Deleting %s from session', field)
    delete ctx.session[field]
}

exports.deleteFromSession = deleteFromSession;
