import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../mongo/schemas/order.schema';
import { User } from '../mongo/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userModel.findOne({ id: userId }).lean().exec();
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const orders = await this.orderModel
      .find({ userId })
      .sort({ createdAt: 'desc' })
      .limit(20)
      .lean()
      .exec();

    const { password: _password, ...safe } = user;
    return { ...safe, orders };
  }
}